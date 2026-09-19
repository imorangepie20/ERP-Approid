import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    BarChart3,
    Mail,
    User,
    Settings,
    ChevronDown,
    ChevronRight,
    ShoppingBag,
    ShoppingCart,
    ClipboardCheck,
    Boxes,
    Factory,
    Wrench,
    Truck,
    Users,
    DollarSign,
} from 'lucide-react'

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
}

interface MenuItem {
    title: string
    icon: React.ReactNode
    path?: string
    children?: { title: string; path: string }[]
}

const menuItems: MenuItem[] = [
    { title: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { title: '운영분석', icon: <BarChart3 size={20} />, path: '/analytics' },
    {
        title: '영업·수주',
        icon: <ShoppingBag size={20} />,
        children: [
            { title: '견적 관리', path: '/sales/quotations' },
            { title: '수주 현황', path: '/sales/orders' },
            { title: '출하 관리', path: '/sales/shipments' },
            { title: '미납 관리', path: '/sales/receivables' },
        ],
    },
    {
        title: '품목·BOM',
        icon: <Boxes size={20} />,
        children: [
            { title: '품목 마스터', path: '/items' },
            { title: 'BOM 관리', path: '/items/bom' },
        ],
    },
    {
        title: '생산관리',
        icon: <Factory size={20} />,
        children: [
            { title: '생산계획', path: '/production/plan' },
            { title: '작업오더', path: '/production/orders' },
            { title: '공정 현황', path: '/production/routing' },
        ],
    },
    {
        title: '자재·구매',
        icon: <ShoppingCart size={20} />,
        children: [
            { title: 'MRP 발주제안', path: '/purchase/mrp' },
            { title: '발주 관리', path: '/purchase/orders' },
            { title: '입고 관리', path: '/purchase/receiving' },
        ],
    },
    {
        title: '재고',
        icon: <Boxes size={20} />,
        children: [
            { title: '재고 현황', path: '/inventory/stock' },
            { title: 'Lot 관리', path: '/inventory/lots' },
        ],
    },
    {
        title: '품질',
        icon: <ClipboardCheck size={20} />,
        children: [
            { title: '검사 실적', path: '/quality/inspections' },
            { title: '불량 관리', path: '/quality/defects' },
        ],
    },
    {
        title: '공정·설비',
        icon: <Wrench size={20} />,
        children: [
            { title: '설비 현황', path: '/equipment' },
            { title: '점검 이력', path: '/equipment/maintenance' },
        ],
    },
    { title: '외주 관리', icon: <Truck size={20} />, path: '/subcontract' },
    { title: '인사·조직', icon: <Users size={20} />, path: '/hr' },
    { title: '원가·회계', icon: <DollarSign size={20} />, path: '/accounting' },
    {
        title: '게시판·알림',
        icon: <Mail size={20} />,
        children: [
            { title: '공지사항', path: '/board/notices' },
            { title: '알림 발송', path: '/board/notify' },
        ],
    },
    { title: 'Profile', icon: <User size={20} />, path: '/profile' },
    { title: 'Settings', icon: <Settings size={20} />, path: '/settings' },
]

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
    const location = useLocation()
    const [expandedMenus, setExpandedMenus] = useState<string[]>([])

    const toggleMenu = (title: string) => {
        setExpandedMenus(prev =>
            prev.includes(title)
                ? prev.filter(item => item !== title)
                : [...prev, title]
        )
    }

    const isActive = (path?: string) => {
        if (!path) return false
        return location.pathname === path
    }

    const isParentActive = (children?: { path: string }[]) => {
        if (!children) return false
        return children.some(child => location.pathname === child.path)
    }

    return (
        <aside
            className={`fixed top-0 left-0 h-full bg-hud-bg-secondary border-r border-hud-border-secondary z-50 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'
                }`}
        >
            {/* Logo */}
            <div className="h-16 flex items-center justify-center border-b border-hud-border-secondary">
                <Link to="/" className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-lg flex items-center justify-center font-bold text-hud-bg-primary">
                        E
                    </div>
                    {!collapsed && (
                        <span className="font-semibold text-lg text-glow">ERP-Approid</span>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className="py-4 overflow-y-auto h-[calc(100%-4rem)]">
                <ul className="space-y-1 px-3">
                    {menuItems.map((item) => (
                        <li key={item.title}>
                            {item.children ? (
                                // Menu with children
                                <div>
                                    <button
                                        onClick={() => toggleMenu(item.title)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-hud ${isParentActive(item.children)
                                            ? 'bg-hud-accent-primary/10 text-hud-accent-primary'
                                            : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                            }`}
                                    >
                                        {item.icon}
                                        {!collapsed && (
                                            <>
                                                <span className="flex-1 text-left text-sm">{item.title}</span>
                                                {expandedMenus.includes(item.title) ? (
                                                    <ChevronDown size={16} />
                                                ) : (
                                                    <ChevronRight size={16} />
                                                )}
                                            </>
                                        )}
                                    </button>

                                    {/* Submenu */}
                                    {!collapsed && expandedMenus.includes(item.title) && (
                                        <ul className="mt-1 ml-8 space-y-1">
                                            {item.children.map((child) => (
                                                <li key={child.path}>
                                                    <Link
                                                        to={child.path}
                                                        className={`block px-3 py-2 rounded-lg text-sm transition-hud ${isActive(child.path)
                                                            ? 'text-hud-accent-primary bg-hud-accent-primary/10'
                                                            : 'text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover'
                                                            }`}
                                                    >
                                                        {child.title}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                // Single menu item
                                <Link
                                    to={item.path!}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-hud ${isActive(item.path)
                                        ? 'menu-active text-hud-accent-primary'
                                        : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                        }`}
                                >
                                    {item.icon}
                                    {!collapsed && <span className="text-sm">{item.title}</span>}
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    )
}

export default Sidebar
