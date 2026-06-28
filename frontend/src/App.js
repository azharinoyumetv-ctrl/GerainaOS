import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";

import DagangOS from "@/pages/DagangOS";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import POS from "@/pages/POS";
import Sales from "@/pages/Sales";
import About from "@/pages/About";
import LicenseDevices from "@/pages/LicenseDevices";

// Submodules
import Categories from "@/pages/products/Categories";
import Brands from "@/pages/products/Brands";
import Units from "@/pages/products/Units";
import StockAdjustment from "@/pages/products/StockAdjustment";
import StockTransfer from "@/pages/products/StockTransfer";

import StockOverview from "@/pages/inventory/StockOverview";
import StockMovement from "@/pages/inventory/StockMovement";
import InventoryValuation from "@/pages/inventory/InventoryValuation";
import LowStock from "@/pages/inventory/LowStock";
import DeadStock from "@/pages/inventory/DeadStock";

import PurchaseOrder from "@/pages/purchase/PurchaseOrder";
import GoodsReceiving from "@/pages/purchase/GoodsReceiving";
import SupplierInvoice from "@/pages/purchase/SupplierInvoice";

import SupplierList from "@/pages/supplier/SupplierList";

import CustomerList from "@/pages/customer/CustomerList";
import Membership from "@/pages/customer/Membership";
import LoyaltyPoints from "@/pages/customer/LoyaltyPoints";

import AccountsReceivable from "@/pages/debt/AccountsReceivable";
import AccountsPayable from "@/pages/debt/AccountsPayable";

import PaymentConfig from "@/pages/payments/PaymentConfig";
import Reports from "@/pages/reports/Reports";

import StaffManagement from "@/pages/staff/StaffManagement";
import Roles from "@/pages/staff/Roles";
import Permissions from "@/pages/staff/Permissions";
import Attendance from "@/pages/staff/Attendance";

import BranchManagement from "@/pages/branches/BranchManagement";
import Integrations from "@/pages/integrations/Integrations";
import Settings from "@/pages/settings/Settings";

import RoleGuard from "@/components/RoleGuard";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-sm text-center text-[hsl(var(--muted))]" data-testid="auth-loading">Memuat sesi…</div>;
  if (!user) return <Navigate to="/geraina/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Direct Auth Top-level & Full URL Mappings */}
          <Route path="/login" element={<Login />} />
          <Route path="/geraina/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/geraina/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/geraina/pricing" element={<Pricing />} />

          {/* Parent Company Landing Page */}
          <Route path="/" element={<DagangOS />} />

          {/* Geraina POS Brand Routes */}
          <Route path="/geraina/*">
            <Route index element={<Landing />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="app/*" element={<Protected><AppLayout /></Protected>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              
              {/* General Routes */}
              <Route path="dashboard" element={<RoleGuard><Dashboard /></RoleGuard>} />
              <Route path="pos" element={<RoleGuard><POS /></RoleGuard>} />
              <Route path="sales" element={<RoleGuard><Sales /></RoleGuard>} />
              <Route path="license" element={<RoleGuard><LicenseDevices /></RoleGuard>} />
              <Route path="about" element={<RoleGuard><About /></RoleGuard>} />

              {/* Produk */}
              <Route path="products" element={<RoleGuard><Products /></RoleGuard>} />
              <Route path="products/categories" element={<RoleGuard><Categories /></RoleGuard>} />
              <Route path="products/brands" element={<RoleGuard><Brands /></RoleGuard>} />
              <Route path="products/units" element={<RoleGuard><Units /></RoleGuard>} />
              <Route path="products/stock-adjustment" element={<RoleGuard><StockAdjustment /></RoleGuard>} />
              <Route path="products/stock-transfer" element={<RoleGuard><StockTransfer /></RoleGuard>} />

              {/* Inventory */}
              <Route path="inventory" element={<RoleGuard><StockOverview /></RoleGuard>} />
              <Route path="inventory/overview" element={<RoleGuard><StockOverview /></RoleGuard>} />
              <Route path="inventory/movement" element={<RoleGuard><StockMovement /></RoleGuard>} />
              <Route path="inventory/valuation" element={<RoleGuard><InventoryValuation /></RoleGuard>} />
              <Route path="inventory/low-stock" element={<RoleGuard><LowStock /></RoleGuard>} />
              <Route path="inventory/dead-stock" element={<RoleGuard><DeadStock /></RoleGuard>} />

              {/* Purchase */}
              <Route path="purchase" element={<RoleGuard><PurchaseOrder /></RoleGuard>} />
              <Route path="purchase/orders" element={<RoleGuard><PurchaseOrder /></RoleGuard>} />
              <Route path="purchase/receiving" element={<RoleGuard><GoodsReceiving /></RoleGuard>} />
              <Route path="purchase/invoices" element={<RoleGuard><SupplierInvoice /></RoleGuard>} />

              {/* Supplier */}
              <Route path="suppliers" element={<RoleGuard><SupplierList /></RoleGuard>} />

              {/* Customer */}
              <Route path="customers" element={<RoleGuard><CustomerList /></RoleGuard>} />
              <Route path="customers/membership" element={<RoleGuard><Membership /></RoleGuard>} />
              <Route path="customers/loyalty" element={<RoleGuard><LoyaltyPoints /></RoleGuard>} />

              {/* Hutang Piutang */}
              <Route path="debt" element={<RoleGuard><AccountsReceivable /></RoleGuard>} />
              <Route path="debt/receivable" element={<RoleGuard><AccountsReceivable /></RoleGuard>} />
              <Route path="debt/payable" element={<RoleGuard><AccountsPayable /></RoleGuard>} />

              {/* Payments */}
              <Route path="settings/payments/*" element={<RoleGuard><PaymentConfig /></RoleGuard>} />
              <Route path="settings/payments" element={<RoleGuard><PaymentConfig /></RoleGuard>} />
              <Route path="payments/*" element={<RoleGuard><PaymentConfig /></RoleGuard>} />
              <Route path="payments" element={<RoleGuard><PaymentConfig /></RoleGuard>} />

              {/* Reports */}
              <Route path="reports/*" element={<RoleGuard><Reports /></RoleGuard>} />
              <Route path="reports" element={<RoleGuard><Reports /></RoleGuard>} />

              {/* Staff */}
              <Route path="staff/*" element={<RoleGuard><StaffManagement /></RoleGuard>} />
              <Route path="staff" element={<RoleGuard><StaffManagement /></RoleGuard>} />

              {/* Branches */}
              <Route path="branches" element={<RoleGuard><BranchManagement /></RoleGuard>} />

              {/* Integrations */}
              <Route path="integrations/*" element={<RoleGuard><Integrations /></RoleGuard>} />
              <Route path="integrations" element={<RoleGuard><Integrations /></RoleGuard>} />

              {/* Settings */}
              <Route path="settings/billing" element={<RoleGuard><Settings /></RoleGuard>} />
              <Route path="billing" element={<RoleGuard><Settings /></RoleGuard>} />
              <Route path="settings/*" element={<RoleGuard><Settings /></RoleGuard>} />
              <Route path="settings" element={<RoleGuard><Settings /></RoleGuard>} />
            </Route>

            {/* Direct un-prefixed management routes & deep links */}
            <Route path="settings/*" element={<AppLayout />} />
            <Route path="payments/*" element={<AppLayout />} />
            <Route path="inventory/*" element={<AppLayout />} />
            <Route path="products/*" element={<AppLayout />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

