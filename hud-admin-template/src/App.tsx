import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import { PublicOnly, RequireAuth } from './auth/RouteGuards'

// Dashboard
import Dashboard from './pages/dashboard/Dashboard'
import Analytics from './pages/dashboard/Analytics'
import SalesAnalysis from './pages/dashboard/SalesAnalysis'
import InventoryAnalysis from './pages/dashboard/InventoryAnalysis'

// Sales
import SalesOrders from './pages/sales/SalesOrders'
import SalesReceivables from './pages/sales/SalesReceivables'
import SalesQuotations from './pages/sales/SalesQuotations'
import SalesShipments from './pages/sales/SalesShipments'

// Items & BOM
import Items from './pages/items/Items'
import ItemBom from './pages/items/ItemBom'
import Partners from './pages/partners/Partners'

// Production
import ProductionPlan from './pages/production/ProductionPlan'
import ProductionOrders from './pages/production/ProductionOrders'
import ProductionRouting from './pages/production/ProductionRouting'

// Purchase
import PurchaseOrders from './pages/purchase/PurchaseOrders'
import PurchaseReceiving from './pages/purchase/PurchaseReceiving'
import PurchaseMrp from './pages/purchase/PurchaseMrp'

// Inventory
import InventoryStock from './pages/inventory/InventoryStock'
import InventoryLots from './pages/inventory/InventoryLots'

// Quality
import QualityInspections from './pages/quality/QualityInspections'
import QualityDefects from './pages/quality/QualityDefects'

// Equipment
import Equipment from './pages/equipment/Equipment'
import EquipmentMaintenance from './pages/equipment/EquipmentMaintenance'

// Subcontract / HR / Accounting
import Subcontract from './pages/subcontract/Subcontract'
import HumanResources from './pages/hr/HumanResources'
import Accounting from './pages/accounting/Accounting'

// Board
import BoardNotices from './pages/board/BoardNotices'
import BoardNotify from './pages/board/BoardNotify'

// Core Pages
import Profile from './pages/Profile'
import Settings from './pages/Settings'

// Auth
import Login from './pages/auth/Login'

// Misc Pages
import Error404 from './pages/Error404'
import ComingSoon from './pages/ComingSoon'

function App() {
    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                {/* Auth Pages (No Layout) */}
                <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                <Route path="/coming-soon" element={<ComingSoon />} />
                <Route path="/404" element={<Error404 />} />

                {/* Main Layout Pages */}
                <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
                    <Route index element={<Dashboard />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="analytics/sales" element={<SalesAnalysis />} />
                    <Route path="analytics/inventory" element={<InventoryAnalysis />} />

                    {/* Sales */}
                    <Route path="sales/quotations" element={<SalesQuotations />} />
                    <Route path="sales/orders" element={<SalesOrders />} />
                    <Route path="sales/receivables" element={<SalesReceivables />} />
                    <Route path="sales/shipments" element={<SalesShipments />} />

                    {/* Items & BOM */}
                    <Route path="items" element={<Items />} />
                    <Route path="items/bom" element={<ItemBom />} />
                    <Route path="partners" element={<Partners />} />

                    {/* Production */}
                    <Route path="production/plan" element={<ProductionPlan />} />
                    <Route path="production/orders" element={<ProductionOrders />} />
                    <Route path="production/routing" element={<ProductionRouting />} />

                    {/* Purchase */}
                    <Route path="purchase/mrp" element={<PurchaseMrp />} />
                    <Route path="purchase/orders" element={<PurchaseOrders />} />
                    <Route path="purchase/receiving" element={<PurchaseReceiving />} />

                    {/* Inventory */}
                    <Route path="inventory/stock" element={<InventoryStock />} />
                    <Route path="inventory/lots" element={<InventoryLots />} />

                    {/* Quality */}
                    <Route path="quality/inspections" element={<QualityInspections />} />
                    <Route path="quality/defects" element={<QualityDefects />} />

                    {/* Equipment */}
                    <Route path="equipment" element={<Equipment />} />
                    <Route path="equipment/maintenance" element={<EquipmentMaintenance />} />

                    {/* Subcontract / HR / Accounting */}
                    <Route path="subcontract" element={<Subcontract />} />
                    <Route path="hr" element={<HumanResources />} />
                    <Route path="accounting" element={<Accounting />} />

                    {/* Board */}
                    <Route path="board/notices" element={<BoardNotices />} />
                    <Route path="board/notify" element={<BoardNotify />} />

                    {/* Core Pages */}
                    <Route path="profile" element={<Profile />} />
                    <Route path="settings" element={<Settings />} />
                </Route>

                {/* 404 Fallback */}
                <Route path="*" element={<Error404 />} />
            </Routes>
        </Router>
    )
}

export default App
