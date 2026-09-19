import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react'
import HudCard from '../../components/common/HudCard'

const UiTabsAccordions = () => {
    const [activeTab, setActiveTab] = useState(0)
    const [activePillTab, setActivePillTab] = useState(0)
    const [activeVerticalTab, setActiveVerticalTab] = useState(0)
    const [openAccordions, setOpenAccordions] = useState<number[]>([0])

    const tabs = ['Home', 'Profile', 'Messages', 'Settings']

    const accordionItems = [
        {
            title: 'What is ALPHA TEAM Template?',
            content: 'ALPHA TEAM Template is a modern, responsive admin dashboard template built with React, TypeScript, and Tailwind CSS. It features a sleek dark theme with neon accents inspired by heads-up display interfaces.',
        },
        {
            title: 'How do I customize the theme?',
            content: 'You can customize the theme by editing the tailwind.config.js file. The color palette, fonts, and animations are all defined there. You can also modify the CSS variables in the index.css file.',
        },
        {
            title: 'Is this template responsive?',
            content: 'Yes! The template is fully responsive and works great on desktop, tablet, and mobile devices. The sidebar collapses on smaller screens and all components adapt to different viewport sizes.',
        },
        {
            title: 'Can I use this for commercial projects?',
            content: 'Please refer to the license included with the template. Most templates allow commercial use, but always check the specific license terms for your use case.',
        },
    ]

    const toggleAccordion = (index: number) => {
        setOpenAccordions(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Tabs & Accordions</h1>
                <p className="text-hud-text-muted mt-1">Organize content with tabs and collapsible sections.</p>
            </div>

            {/* Basic Tabs */}
            <HudCard title="Basic Tabs" subtitle="Standard tab navigation">
                <div>
                    <div className="flex border-b border-hud-border-secondary">
                        {tabs.map((tab, i) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(i)}
                                className={`px-4 py-3 text-sm font-medium transition-hud ${activeTab === i
                                    ? 'text-hud-accent-primary border-b-2 border-hud-accent-primary -mb-px'
                                    : 'text-hud-text-secondary hover:text-hud-text-primary'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="p-4">
                        {activeTab === 0 && (
                            <p className="text-hud-text-secondary">
                                This is the Home tab content. You can put any content here including text, images, forms, or other components.
                            </p>
                        )}
                        {activeTab === 1 && (
                            <p className="text-hud-text-secondary">
                                Profile tab content goes here. Display user information, settings, or any profile-related data.
                            </p>
                        )}
                        {activeTab === 2 && (
                            <p className="text-hud-text-secondary">
                                Messages tab content. Show a list of messages, notifications, or communication history.
                            </p>
                        )}
                        {activeTab === 3 && (
                            <p className="text-hud-text-secondary">
                                Settings tab content. Configure preferences, options, and customization settings.
                            </p>
                        )}
                    </div>
                </div>
            </HudCard>

            {/* Pill Tabs */}
            <HudCard title="Pill Tabs" subtitle="Rounded pill-style tabs">
                <div>
                    <div className="flex gap-2 p-1 bg-hud-bg-primary rounded-lg inline-flex">
                        {tabs.map((tab, i) => (
                            <button
                                key={tab}
                                onClick={() => setActivePillTab(i)}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-hud ${activePillTab === i
                                    ? 'bg-hud-accent-primary text-hud-bg-primary'
                                    : 'text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="p-4 mt-4">
                        <p className="text-hud-text-secondary">
                            Content for <span className="text-hud-accent-primary">{tabs[activePillTab]}</span> tab.
                            Pill tabs have a more modern, rounded appearance.
                        </p>
                    </div>
                </div>
            </HudCard>

            {/* Vertical Tabs */}
            <HudCard title="Vertical Tabs" subtitle="Side navigation style tabs">
                <div className="flex gap-6">
                    <div className="w-48 shrink-0">
                        <div className="space-y-1">
                            {tabs.map((tab, i) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveVerticalTab(i)}
                                    className={`w-full px-4 py-2.5 text-sm font-medium text-left rounded-lg transition-hud ${activeVerticalTab === i
                                        ? 'bg-hud-accent-primary/10 text-hud-accent-primary border-l-2 border-hud-accent-primary'
                                        : 'text-hud-text-secondary hover:text-hud-text-primary hover:bg-hud-bg-hover'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 p-4 bg-hud-bg-primary rounded-lg">
                        <h4 className="font-semibold text-hud-text-primary mb-2">{tabs[activeVerticalTab]}</h4>
                        <p className="text-hud-text-secondary">
                            This is the content for the {tabs[activeVerticalTab]} tab. Vertical tabs work great for
                            settings pages or when you have many navigation options.
                        </p>
                    </div>
                </div>
            </HudCard>

            {/* Basic Accordion */}
            <HudCard title="Accordion" subtitle="Collapsible content sections">
                <div className="space-y-3">
                    {accordionItems.map((item, i) => (
                        <div key={i} className="border border-hud-border-secondary rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleAccordion(i)}
                                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-hud ${openAccordions.includes(i) ? 'bg-hud-accent-primary/10' : 'hover:bg-hud-bg-hover'
                                    }`}
                            >
                                <span className={`font-medium ${openAccordions.includes(i) ? 'text-hud-accent-primary' : 'text-hud-text-primary'}`}>
                                    {item.title}
                                </span>
                                {openAccordions.includes(i) ? (
                                    <ChevronUp size={18} className="text-hud-accent-primary" />
                                ) : (
                                    <ChevronDown size={18} className="text-hud-text-muted" />
                                )}
                            </button>
                            {openAccordions.includes(i) && (
                                <div className="px-4 py-3 border-t border-hud-border-secondary bg-hud-bg-primary/50">
                                    <p className="text-sm text-hud-text-secondary">{item.content}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </HudCard>

            {/* Icon Accordion */}
            <HudCard title="Icon Accordion" subtitle="Accordion with plus/minus icons">
                <div className="space-y-3">
                    {accordionItems.slice(0, 3).map((item, i) => (
                        <div key={i} className="hud-card hud-card-bottom rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleAccordion(i + 10)}
                                className="w-full flex items-center justify-between px-4 py-4 text-left"
                            >
                                <span className="font-medium text-hud-text-primary">{item.title}</span>
                                <div className={`w-6 h-6 rounded flex items-center justify-center transition-hud ${openAccordions.includes(i + 10) ? 'bg-hud-accent-primary text-hud-bg-primary' : 'bg-hud-bg-primary text-hud-text-muted'
                                    }`}>
                                    {openAccordions.includes(i + 10) ? <Minus size={14} /> : <Plus size={14} />}
                                </div>
                            </button>
                            {openAccordions.includes(i + 10) && (
                                <div className="px-4 pb-4">
                                    <p className="text-sm text-hud-text-secondary">{item.content}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </HudCard>

            {/* Cards with Tabs */}
            <HudCard title="Card with Tabs" subtitle="Tabs integrated into card header" noPadding>
                <div className="flex border-b border-hud-border-secondary">
                    {['Overview', 'Analytics', 'Reports'].map((tab, i) => (
                        <button
                            key={tab}
                            className={`px-4 py-3 text-sm font-medium transition-hud ${i === 0
                                ? 'text-hud-accent-primary border-b-2 border-hud-accent-primary -mb-px'
                                : 'text-hud-text-secondary hover:text-hud-text-primary'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="p-5">
                    <p className="text-hud-text-secondary">
                        This card has tabs integrated directly into its header. Great for dashboard widgets
                        that need to show different views of the same data.
                    </p>
                </div>
            </HudCard>
        </div>
    )
}

export default UiTabsAccordions
