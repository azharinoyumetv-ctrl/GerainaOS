"""Server-side PDF generation: thermal receipt (80mm) + A4 invoice."""
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

BRAND_GREEN = colors.HexColor("#1A3B2B")
BRAND_TERRACOTTA = colors.HexColor("#D14B33")
INK = colors.HexColor("#1C1C1C")
MUTED = colors.HexColor("#5A5A5A")
LINE = colors.HexColor("#E0DBD2")


def _fmt_idr(n: float) -> str:
    try:
        return f"Rp {int(round(n)):,}".replace(",", ".")
    except Exception:
        return f"Rp {n}"


async def _load_order(order_id: str, user: dict) -> dict:
    db = get_db()
    order = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    store = await db.stores.find_one({"id": user["store_id"]}, {"_id": 0}) or {}
    return {"order": order, "store": store}


# ---------- THERMAL 80mm ----------
def _thermal_pdf(order: dict, store: dict) -> bytes:
    """Generate thermal receipt 80mm wide x dynamic height."""
    width = 80 * mm
    n_items = len(order.get("items", []))
    height = (90 + n_items * 10) * mm  # rough dynamic
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))

    def line_sep(y: float) -> float:
        c.setStrokeColor(LINE)
        c.setDash(1, 2)
        c.line(4 * mm, y, width - 4 * mm, y)
        c.setDash()
        return y - 3 * mm

    y = height - 6 * mm
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(BRAND_GREEN)
    c.drawCentredString(width / 2, y, store.get("name", "Geraina POS"))
    y -= 4.5 * mm
    c.setFont("Helvetica", 7)
    c.setFillColor(MUTED)
    c.drawCentredString(width / 2, y, "Geraina POS by DagangOS")
    y -= 4 * mm
    y = line_sep(y)

    c.setFillColor(INK)
    c.setFont("Helvetica", 8)
    c.drawString(4 * mm, y, f"No: {order.get('order_no', '-')}")
    y -= 3.5 * mm
    created = order.get("created_at", "")[:19].replace("T", " ")
    c.drawString(4 * mm, y, f"Tgl: {created}")
    y -= 3.5 * mm
    c.drawString(4 * mm, y, f"Kasir: {order.get('cashier_email', '-')}")
    y -= 3 * mm
    y = line_sep(y)

    c.setFont("Helvetica-Bold", 8)
    c.drawString(4 * mm, y, "Item")
    c.drawRightString(width - 4 * mm, y, "Subtotal")
    y -= 3.5 * mm
    c.setFont("Helvetica", 8)

    for it in order.get("items", []):
        c.drawString(4 * mm, y, f"{it['name'][:26]}")
        y -= 3.2 * mm
        c.setFillColor(MUTED)
        c.drawString(6 * mm, y, f"{it['quantity']} x {_fmt_idr(it['price'])}")
        c.setFillColor(INK)
        c.drawRightString(width - 4 * mm, y, _fmt_idr(it['subtotal']))
        y -= 4 * mm

    y = line_sep(y)
    c.setFont("Helvetica", 8)
    c.drawString(4 * mm, y, "Subtotal")
    c.drawRightString(width - 4 * mm, y, _fmt_idr(order.get("subtotal", 0)))
    y -= 3.5 * mm
    if order.get("discount", 0):
        c.drawString(4 * mm, y, "Diskon")
        c.drawRightString(width - 4 * mm, y, f"-{_fmt_idr(order['discount'])}")
        y -= 3.5 * mm
    if order.get("tax_amount", 0):
        c.drawString(4 * mm, y, f"PPN {order.get('tax_percent',0)}%")
        c.drawRightString(width - 4 * mm, y, _fmt_idr(order["tax_amount"]))
        y -= 3.5 * mm

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(BRAND_GREEN)
    c.drawString(4 * mm, y, "TOTAL")
    c.drawRightString(width - 4 * mm, y, _fmt_idr(order.get("total", 0)))
    y -= 4 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica", 8)

    pm = (order.get("payment_method") or "").upper()
    if order.get("ewallet_channel"):
        pm += f" ({order['ewallet_channel']})"
    c.drawString(4 * mm, y, f"Bayar: {pm}")
    c.drawRightString(width - 4 * mm, y, str(order.get("payment_status", "")).upper())
    y -= 3.5 * mm
    if order.get("cash_received") is not None:
        c.drawString(4 * mm, y, "Tunai")
        c.drawRightString(width - 4 * mm, y, _fmt_idr(order["cash_received"]))
        y -= 3.5 * mm
        c.drawString(4 * mm, y, "Kembalian")
        c.drawRightString(width - 4 * mm, y, _fmt_idr(order.get("change") or 0))
        y -= 3.5 * mm

    y -= 2 * mm
    y = line_sep(y)
    c.setFont("Helvetica", 7)
    c.setFillColor(MUTED)
    c.drawCentredString(width / 2, y, "Terima kasih atas kunjungan Anda!")
    y -= 3 * mm
    c.drawCentredString(width / 2, y, "Powered by Geraina POS")

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


# ---------- A4 INVOICE ----------
def _invoice_pdf(order: dict, store: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Invoice {order.get('order_no')}",
    )
    styles = getSampleStyleSheet()
    h_title = ParagraphStyle("h_title", parent=styles["Title"], fontName="Helvetica-Bold",
                             fontSize=22, textColor=BRAND_GREEN, alignment=TA_LEFT, spaceAfter=2)
    p_meta = ParagraphStyle("p_meta", parent=styles["Normal"], fontSize=9, textColor=MUTED)
    p_label = ParagraphStyle("p_label", parent=styles["Normal"], fontSize=8, textColor=MUTED,
                             alignment=TA_RIGHT, spaceAfter=2)
    p_value = ParagraphStyle("p_value", parent=styles["Normal"], fontSize=11, textColor=INK,
                             alignment=TA_RIGHT, fontName="Helvetica-Bold")
    p_h = ParagraphStyle("p_h", parent=styles["Normal"], fontSize=10, textColor=BRAND_GREEN,
                         fontName="Helvetica-Bold", spaceAfter=4)
    p_body = ParagraphStyle("p_body", parent=styles["Normal"], fontSize=10, textColor=INK)
    p_small_right = ParagraphStyle("p_small_right", parent=styles["Normal"], fontSize=9,
                                   textColor=MUTED, alignment=TA_RIGHT)

    story = []

    # Header
    header_table = Table(
        [[
            [Paragraph("INVOICE", h_title), Paragraph(f"No. {order.get('order_no','-')}", p_meta)],
            [Paragraph("Geraina POS", p_label), Paragraph(store.get("name", "Geraina Store"), p_value),
             Paragraph("by DagangOS", p_small_right)],
        ]],
        colWidths=[100 * mm, 70 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))
    story.append(Table([[""]], colWidths=[170 * mm], rowHeights=[0.6],
                       style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.8, BRAND_GREEN)])))
    story.append(Spacer(1, 6 * mm))

    # Bill to / meta
    created = order.get("created_at", "")[:10]
    meta = Table(
        [[
            [Paragraph("DITAGIHKAN KEPADA", p_label), Paragraph(order.get("customer_name") or "Walk-in Customer", p_body),
             Paragraph(order.get("customer_email") or "", p_meta),
             Paragraph(order.get("customer_phone") or "", p_meta)],
            [Paragraph("TANGGAL", p_label), Paragraph(created, p_body),
             Paragraph("STATUS", p_label),
             Paragraph(str(order.get("payment_status", "")).upper(), p_body)],
        ]],
        colWidths=[100 * mm, 70 * mm],
    )
    meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(meta)
    story.append(Spacer(1, 8 * mm))

    # Items table
    data = [["#", "Produk", "Qty", "Harga", "Subtotal"]]
    for idx, it in enumerate(order.get("items", []), 1):
        data.append([
            str(idx),
            it["name"],
            f"{it['quantity']} x",
            _fmt_idr(it["price"]),
            _fmt_idr(it["subtotal"]),
        ])

    table = Table(data, colWidths=[10 * mm, 80 * mm, 20 * mm, 30 * mm, 30 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBF8F2")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 6 * mm))

    # Totals
    rows = [
        ["Subtotal", _fmt_idr(order.get("subtotal", 0))],
    ]
    if order.get("discount", 0):
        rows.append(["Diskon", f"-{_fmt_idr(order['discount'])}"])
    if order.get("tax_amount", 0):
        rows.append([f"PPN {order.get('tax_percent',0)}%", _fmt_idr(order["tax_amount"])])
    rows.append(["TOTAL", _fmt_idr(order.get("total", 0))])

    totals = Table(rows, colWidths=[40 * mm, 30 * mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -2), MUTED),
        ("TEXTCOLOR", (0, -1), (-1, -1), BRAND_GREEN),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 13),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, -1), (-1, -1), 0.6, BRAND_GREEN),
    ]))
    story.append(totals)
    story.append(Spacer(1, 14 * mm))

    pm = (order.get("payment_method") or "").upper()
    if order.get("ewallet_channel"):
        pm += f" via {order['ewallet_channel']}"
    story.append(Paragraph("Metode Pembayaran", p_label))
    story.append(Paragraph(pm, p_body))
    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph("Terima kasih telah berbelanja. Invoice ini dihasilkan otomatis oleh Geraina POS.", p_meta))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ---------- Endpoints ----------
@router.get("/receipt/{order_id}")
async def receipt_pdf(order_id: str, user: dict = Depends(get_current_user)):
    data = await _load_order(order_id, user)
    pdf = _thermal_pdf(data["order"], data["store"])
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="receipt-{data["order"]["order_no"]}.pdf"',
    })


@router.get("/invoice/{order_id}")
async def invoice_pdf(order_id: str, user: dict = Depends(get_current_user)):
    data = await _load_order(order_id, user)
    pdf = _invoice_pdf(data["order"], data["store"])
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="invoice-{data["order"]["order_no"]}.pdf"',
    })
