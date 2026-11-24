import './App.css';
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import Login from "./Pages/LoginPages/Login.jsx";
import NavBar from "./components/NavBar.jsx";
import PageNotFound from "./Pages/PageNotFound/PageNotFound.jsx";
import Home from "./Components/Home/Home.jsx";
import TailorMasterDashboard from "./Pages/TailorMasterDashboard/TailorMasterDashboard.jsx";
import OrderDetails from "./Pages/TailorMasterDashboard/OrderDetails/OrderDetails.jsx";
import UnderMaintenance from "./Pages/UnderMaintenance/UnderMaintenance.jsx";
import MyOrdersTM from "./Pages/TailorMasterDashboard/MyOrdersTM/MyOrdersTM.jsx";
import DeliveriesPage from "./Pages/ShopOwner/Deliveries/DeliveriesPage.jsx";
import ForgotPassword from "./Pages/LoginPages/ForgotPassword/ForgotPassword.jsx";
import ResetPassword from "./Pages/LoginPages/ResetPassword/ResetPassword.jsx";
import InvoiceDownload from "./Pages/InvoiceDownload.jsx"
import ReceiptDownload from "./Pages/ReceiptDownload.jsx"
import ShopOwnerLayout from "./Pages/ShopOwner/ShopOwnerLayout.jsx";
import ShopOwnerDashboard from "./Pages/ShopOwner/Dashboard/Dashboard.jsx";
import InvoicesPage from "./Pages/ShopOwner/Invoices/InvoicesPage.jsx";
import InvoiceDetail from "./Pages/ShopOwner/Invoices/InvoiceDetail.jsx";
import DeletedInvoiceDetail from "./Pages/ShopOwner/Invoices/DeletedInvoiceDetail.jsx";
import EmployeesPage from "./Pages/ShopOwner/Employees/EmployeesPage.jsx";
import ExpensesPage from "./Pages/ShopOwner/Expenses/ExpensesPage.jsx";
import TailorMasterLayout from "./Pages/TailorMaster/TailorMasterLayout.jsx";
import CuttingQueuePage from "./Pages/TailorMaster/Cutting/CuttingQueuePage.jsx";
import OrderItemsPage from "./Pages/TailorMaster/Orders/OrderItemsPage.jsx";
import AssignBoardPage from "./Pages/TailorMaster/Assign/AssignBoardPage.jsx";
import FollowUpPage from "./Pages/TailorMaster/FollowUp/FollowUpPage.jsx";
import MyWorkPage from "./Pages/TailorMaster/MyWork/MyWorkPage.jsx";
import TailorLayout from "./Pages/Tailor/TailorLayout.jsx";
import TailorWorkQueuePage from "./Pages/Tailor/Queue/WorkQueuePage.jsx";
import TailorAssignPage from "./Pages/Tailor/Assign/AssignAssistantPage.jsx";
import TailorMyWorkPage from "./Pages/Tailor/MyWork/MyWorkPage.jsx";
import ShopAssistantLayout from "./Pages/ShopAssistant/ShopAssistantLayout.jsx";
import OwnerLayout from "./Pages/Owner/OwnerLayout.jsx";
import OwnerOverviewPage from "./Pages/Owner/Overview/OverviewPage.jsx";
import OwnerBranchesPage from "./Pages/Owner/Branches/BranchesPage.jsx";
import OwnerBranchPage from "./Pages/Owner/Branches/BranchPage.jsx";
import OwnerBranchInvoicePage from "./Pages/Owner/Branches/BranchInvoicePage.jsx";
import OwnerComparePage from "./Pages/Owner/Compare/ComparePage.jsx";
import OwnerExpensesPage from "./Pages/Owner/Expenses/OwnerExpensesPage.jsx";
import OwnerProductionPage from "./Pages/Owner/Production/ProductionPage.jsx";
import OwnerPeoplePage from "./Pages/Owner/People/PeoplePage.jsx";
import OwnerAuditPage from "./Pages/Owner/Audit/AuditPage.jsx";
import OwnerCustomersPage from "./Pages/Owner/Customers/CustomersPage.jsx";
import AssistantJobsPage from "./Pages/ShopAssistant/Jobs/MyJobsPage.jsx";
import AssistantMyWorkPage from "./Pages/ShopAssistant/MyWork/MyWorkPage.jsx";


const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/download-invoice/:invoiceId",
        element: <InvoiceDownload />
    },
    {
        path: "/download-receipt/:receiptId",
        element: <ReceiptDownload />
    },
    {
        // Link sent to the customer after each payment (GET /public/documents/payment-receipts/{token})
        path: "/download-payment-receipt/:receiptId",
        element: <ReceiptDownload kind="payment-receipts" label="payment receipt" filePrefix="PaymentReceipt" />
    },
    {
        path: "/forgot-password",
        element: <ForgotPassword />
    },
    {
        path: "/resert-password/:email/:code",
        element: <ResetPassword />
    },
    {
        // SHOP_OWNER app (sidebar shell): dashboard, invoices, deliveries, employees, expenses.
        path: "/shopOwner",
        element: <ShopOwnerLayout />,
        children: [
            { index: true, element: <Navigate to="/shopOwner/dashboard" replace /> },
            { path: "dashboard", element: <ShopOwnerDashboard /> },
            { path: "invoices", element: <InvoicesPage /> },
            { path: "invoices/deleted/:archiveId", element: <DeletedInvoiceDetail /> },
            { path: "invoices/:invoiceId", element: <InvoiceDetail /> },
            { path: "deliveries", element: <DeliveriesPage /> },
            { path: "employees", element: <EmployeesPage /> },
            { path: "expenses", element: <ExpensesPage /> }
        ]
    },
    {
        // TAILOR_MASTER app (own layout): the old tailor master functionality in the new UI.
        // The old screens stay below under NavBar until they are deleted (/tailorMaster/legacy, /:invoiceId, /my-orders…).
        path: "/tailorMaster",
        element: <TailorMasterLayout />,
        children: [
            { index: true, element: <Navigate to="/tailorMaster/cutting" replace /> },
            { path: "cutting", element: <CuttingQueuePage /> },
            { path: "orders/:invoiceId", element: <OrderItemsPage /> },
            { path: "assign", element: <AssignBoardPage /> },
            { path: "follow-up", element: <FollowUpPage /> },
            { path: "my-work", element: <MyWorkPage /> }
        ]
    },
    {
        // TAILOR app (own layout): work queue, assign shop assistant, my work.
        // The old tailor screens are no longer routed (TailorDashboard/*), kept until their deletion is OK'd.
        path: "/tailor",
        element: <TailorLayout />,
        children: [
            { index: true, element: <Navigate to="/tailor/queue" replace /> },
            { path: "queue", element: <TailorWorkQueuePage /> },
            { path: "assign", element: <TailorAssignPage /> },
            { path: "my-work", element: <TailorMyWorkPage /> }
        ]
    },
    {
        // SHOP_ASSISTANT app (own layout): my jobs (hemming → ironing → completed), my progress.
        // The old screen (ShopAssistance/*) is no longer routed, kept until its deletion is OK'd.
        path: "/shopAssistant",
        element: <ShopAssistantLayout />,
        children: [
            { index: true, element: <Navigate to="/shopAssistant/jobs" replace /> },
            { path: "jobs", element: <AssistantJobsPage /> },
            { path: "my-work", element: <AssistantMyWorkPage /> }
        ]
    },
    {
        // Platform OWNER app (own layout): overview, branches (+ admin), compare, expenses, production, people,
        // customers, audit. The old owner screens (/dashboard…, /home) were deleted.
        path: "/owner",
        element: <OwnerLayout />,
        children: [
            { index: true, element: <Navigate to="/owner/overview" replace /> },
            { path: "overview", element: <OwnerOverviewPage /> },
            { path: "branches", element: <OwnerBranchesPage /> },
            { path: "branches/:shopId", element: <OwnerBranchPage /> },
            { path: "branches/:shopId/invoices/:invoiceId", element: <OwnerBranchInvoicePage /> },
            { path: "compare", element: <OwnerComparePage /> },
            { path: "expenses", element: <OwnerExpensesPage /> },
            { path: "production", element: <OwnerProductionPage /> },
            { path: "people", element: <OwnerPeoplePage /> },
            { path: "audit", element: <OwnerAuditPage /> },
            { path: "customers", element: <OwnerCustomersPage /> }
        ]
    },
    {
        // Old address (bookmarks) -> the new shop assistant app.
        path: "/ShopAssistance",
        element: <Navigate to="/shopAssistant/jobs" replace />
    },
    {
        path: "/",
        element: <NavBar />,
        children: [
            {
                index: true,
                element: (<Home/>)
            },
            {
                path: "/undermaintenance",
                element: (<UnderMaintenance />)
            },
            {
                path: "*",
                element: <PageNotFound />
            }
        ],

    },
]);

function App() {
    return <RouterProvider router={router} />;
}

export default App;
