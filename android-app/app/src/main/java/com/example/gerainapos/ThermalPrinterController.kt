package com.example.gerainapos

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.PendingIntent
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.lang.ref.WeakReference

class ThermalPrinterController(private val activity: ComponentActivity, private val notice: (String) -> Unit) {
    companion object {
        private val jobs = Executors.newSingleThreadExecutor()
        private val jobBusy = AtomicBoolean(false)
        private val main = Handler(Looper.getMainLooper())
        private var observer: WeakReference<ThermalPrinterController>? = null
        private fun publish(message: String) { main.post { observer?.get()?.notice?.invoke(message) } }
    }
    private val preferences = activity.getSharedPreferences("receipt-printer", Context.MODE_PRIVATE)
    private val executor = jobs
    private val handler = Handler(Looper.getMainLooper())
    private val busy = jobBusy
    private var socket: BluetoothSocket? = null
    private var permissionAction: (() -> Unit)? = null
    private var usbAction: (() -> Unit)? = null
    private val usbPermission = "${activity.packageName}.RECEIPT_USB_PERMISSION"
    private val requestBluetooth = activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val action = permissionAction; permissionAction = null
        if (granted) action?.invoke() else notice("Izin Perangkat di sekitar diperlukan untuk printer Bluetooth.")
    }
    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != usbPermission) return
            val action = usbAction; usbAction = null
            if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) action?.invoke() else notice("Izin printer USB ditolak.")
        }
    }
    init { observer = WeakReference(this); activity.registerReceiver(usbReceiver, IntentFilter(usbPermission), Context.RECEIVER_NOT_EXPORTED) }

    private fun bluetoothAllowed(action: () -> Unit) {
        if (activity.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) action()
        else if (permissionAction == null) { permissionAction = action; requestBluetooth.launch(Manifest.permission.BLUETOOTH_CONNECT) }
        else notice("Selesaikan permintaan izin sebelumnya.")
    }

    fun configure(after: (() -> Unit)? = null) {
        if (busy.get()) { notice("Printer sedang mengirim struk."); return }
        AlertDialog.Builder(activity).setTitle("Hubungkan printer struk")
            .setItems(arrayOf("Bluetooth", "USB / OTG")) { _, which -> if (which == 0) bluetoothAllowed { selectBluetooth(after) } else selectUsb(after) }
            .setNegativeButton("Batal", null).show()
    }

    @SuppressLint("MissingPermission")
    private fun selectBluetooth(after: (() -> Unit)?) {
        val adapter = activity.getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null) { notice("Perangkat ini tidak menyediakan Bluetooth."); return }
        if (!adapter.isEnabled) { activity.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); notice("Aktifkan Bluetooth dan pasangkan printer, lalu kembali ke Geraina."); return }
        val devices = adapter.bondedDevices.filter { it.type != android.bluetooth.BluetoothDevice.DEVICE_TYPE_LE }.sortedBy { it.name ?: it.address }
        if (devices.isEmpty()) {
            AlertDialog.Builder(activity).setTitle("Pasangkan printer terlebih dahulu")
                .setMessage("Pasangkan printer struk Bluetooth melalui Pengaturan Android. Gunakan printer ESC/POS dengan koneksi Bluetooth Classic; printer BLE atau protokol khusus belum didukung.")
                .setPositiveButton("Buka pengaturan") { _, _ -> activity.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }.setNegativeButton("Batal", null).show(); return
        }
        AlertDialog.Builder(activity).setTitle("Pilih printer Bluetooth")
            .setItems(devices.map { "${it.name ?: "Printer"}\n${it.address}" }.toTypedArray()) { _, which ->
                preferences.edit().putString("transport", "bluetooth").putString("address", devices[which].address).apply(); choosePaper(after)
            }.setNegativeButton("Batal", null).show()
    }

    private fun selectUsb(after: (() -> Unit)?) {
        val manager = activity.getSystemService(UsbManager::class.java)
        val devices = manager.deviceList.values.filter { device -> (0 until device.interfaceCount).any { device.getInterface(it).interfaceClass == UsbConstants.USB_CLASS_PRINTER } }
        if (devices.isEmpty()) { notice("Sambungkan printer USB ESC/POS melalui OTG. Printer serial khusus memerlukan driver tersendiri."); return }
        AlertDialog.Builder(activity).setTitle("Pilih printer USB")
            .setItems(devices.map { it.productName ?: "USB ${it.vendorId}:${it.productId}" }.toTypedArray()) { _, which ->
                preferences.edit().putString("transport", "usb").putString("address", devices[which].deviceName).apply(); choosePaper(after)
            }.setNegativeButton("Batal", null).show()
    }

    private fun choosePaper(after: (() -> Unit)?) {
        AlertDialog.Builder(activity).setTitle("Lebar kertas")
            .setItems(arrayOf("58 mm (32 karakter)", "80 mm (48 karakter)")) { _, which ->
                preferences.edit().putInt("columns", if (which == 0) 32 else 48).apply()
                if (after == null) notice("Printer tersimpan. Gunakan Cetak contoh untuk menguji hasilnya.") else after()
            }.setNegativeButton("Batal", null).show()
    }

    fun print(order: JSONObject, store: String) {
        val parsed = runCatching {
            val items = order.getJSONArray("items"); require(items.length() in 1..500)
            val rows = (0 until items.length()).map { index -> val item = items.getJSONObject(index); ReceiptLine(item.getString("name"), item.getInt("quantity"), item.getDouble("price"), item.getDouble("subtotal")) }
            ThermalReceipt(order.optString("store_name", store).ifBlank { store }, order.getString("order_no"), order.optString("created_at"), rows,
                order.getDouble("subtotal"), order.optDouble("discount", 0.0), order.optDouble("tax_amount", 0.0), order.getDouble("total"),
                order.optDouble("cash_received", order.getDouble("total")), order.optDouble("change", 0.0), order.optString("sync_status") == "pending",
                order.optJSONObject("receipt_settings")?.optString("footer_text", "Terima kasih") ?: "Terima kasih")
        }.getOrElse { notice("Data struk tidak valid."); return }
        send(parsed)
    }

    fun sample() = send(ThermalReceipt("Geraina · Tes printer", "CONTOH - BUKAN PENJUALAN", "", listOf(ReceiptLine("Produk contoh", 1, 10000.0, 10000.0)), 10000.0, 0.0, 0.0, 10000.0, 20000.0, 10000.0, false))

    private fun send(receipt: ThermalReceipt) {
        val transport = preferences.getString("transport", null)
        if (transport == null || !preferences.contains("columns")) { configure { send(receipt) }; return }
        val bytes = runCatching { ReceiptEncoder.encode(receipt, preferences.getInt("columns", 32)) }.getOrElse { notice("Nominal atau isi struk tidak valid."); return }
        if (transport == "bluetooth") bluetoothAllowed { writeBluetooth(bytes) } else writeUsb(bytes)
    }

    @SuppressLint("MissingPermission")
    private fun writeBluetooth(bytes: ByteArray) {
        if (!busy.compareAndSet(false, true)) { notice("Tunggu struk sebelumnya selesai."); return }
        notice("Menghubungkan printer…")
        executor.execute {
            var timedSocket: BluetoothSocket? = null
            val timeout = Runnable { runCatching { timedSocket?.close() } }
            val result = runCatching {
                val adapter = activity.getSystemService(BluetoothManager::class.java)?.adapter ?: error("Bluetooth tidak tersedia")
                check(adapter.isEnabled) { "Bluetooth belum aktif" }
                val device = adapter.getRemoteDevice(preferences.getString("address", ""))
                val connection = device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805f9b34fb"))
                socket = connection; timedSocket = connection; handler.postDelayed(timeout, 15000)
                connection.use { it.connect(); bytes.asList().chunked(256).forEach { chunk -> it.outputStream.write(chunk.toByteArray()); it.outputStream.flush(); Thread.sleep(20) } }
            }
            handler.removeCallbacks(timeout); socket = null; busy.set(false)
            publish(if (result.isSuccess) "Data struk terkirim ke printer. Periksa hasil cetak." else "Printer tidak tersambung atau cetak terputus. Periksa printer dan struk sebelum mencetak ulang.")
        }
    }

    private fun writeUsb(bytes: ByteArray) {
        val manager = activity.getSystemService(UsbManager::class.java)
        val device: UsbDevice = manager.deviceList[preferences.getString("address", "")] ?: run { notice("Printer USB terlepas. Hubungkan dan pilih printer kembali."); return }
        if (!manager.hasPermission(device)) {
            if (usbAction != null) { notice("Selesaikan permintaan izin USB sebelumnya."); return }
            usbAction = { writeUsb(bytes) }
            manager.requestPermission(device, PendingIntent.getBroadcast(activity, 81, Intent(usbPermission).setPackage(activity.packageName), PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)); return
        }
        if (!busy.compareAndSet(false, true)) { notice("Tunggu struk sebelumnya selesai."); return }
        executor.execute {
            val result = runCatching {
                val connection = manager.openDevice(device) ?: error("USB tidak tersedia")
                try {
                    val intf = (0 until device.interfaceCount).map { device.getInterface(it) }.first { it.interfaceClass == UsbConstants.USB_CLASS_PRINTER }
                    val endpoint = (0 until intf.endpointCount).map { intf.getEndpoint(it) }.first { it.direction == UsbConstants.USB_DIR_OUT && it.type == UsbConstants.USB_ENDPOINT_XFER_BULK }
                    check(connection.claimInterface(intf, true))
                    try { var offset = 0; while (offset < bytes.size) { val written = connection.bulkTransfer(endpoint, bytes, offset, minOf(1024, bytes.size - offset), 5000); check(written > 0); offset += written } }
                    finally { connection.releaseInterface(intf) }
                } finally { connection.close() }
            }
            busy.set(false); publish(if (result.isSuccess) "Data struk terkirim ke printer USB. Periksa hasil cetak." else "Cetak USB terputus. Periksa struk sebelum mencetak ulang.")
        }
    }

    // A short, explicitly requested print continues through activity rotation. Its
    // timeout closes the connection; the shared busy flag prevents a second job.
    fun close() { runCatching { activity.unregisterReceiver(usbReceiver) }; if (observer?.get() === this) observer = null }
}
