import { Check } from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'

const plans = [
    {
        name: 'Starter',
        price: 0,
        description: 'Perfect for trying out the platform',
        features: [
            '5 Projects',
            '10 GB Storage',
            'Basic Analytics',
            'Email Support',
            'API Access',
        ],
        notIncluded: [
            'Priority Support',
            'Custom Integrations',
            'Advanced Analytics',
            'Team Collaboration',
        ],
        popular: false,
    },
    {
        name: 'Professional',
        price: 29,
        description: 'Best for growing businesses',
        features: [
            'Unlimited Projects',
            '100 GB Storage',
            'Advanced Analytics',
            'Priority Support',
            'API Access',
            'Team Collaboration',
            'Custom Integrations',
        ],
        notIncluded: [
            'Dedicated Account Manager',
        ],
        popular: true,
    },
    {
        name: 'Enterprise',
        price: 99,
        description: 'For large organizations',
        features: [
            'Unlimited Projects',
            'Unlimited Storage',
            'Advanced Analytics',
            '24/7 Phone Support',
            'API Access',
            'Team Collaboration',
            'Custom Integrations',
            'Dedicated Account Manager',
            'SLA Guarantee',
            'Custom Training',
        ],
        notIncluded: [],
        popular: false,
    },
]

const Pricing = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-hud-text-primary">Pricing Plans</h1>
                <p className="text-hud-text-secondary mt-2">
                    Choose the perfect plan for your needs. All plans include a 14-day free trial.
                </p>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-4">
                <span className="text-hud-text-primary">Monthly</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-hud-bg-primary rounded-full peer peer-checked:bg-hud-accent-primary transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
                </label>
                <span className="text-hud-text-secondary">
                    Yearly <span className="text-hud-accent-success text-sm">(Save 20%)</span>
                </span>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {plans.map((plan) => (
                    <div
                        key={plan.name}
                        className={`hud-card hud-card-bottom rounded-xl overflow-hidden ${plan.popular ? 'ring-2 ring-hud-accent-primary' : ''
                            }`}
                    >
                        {plan.popular && (
                            <div className="bg-hud-accent-primary text-hud-bg-primary text-center text-sm py-1 font-medium">
                                Most Popular
                            </div>
                        )}
                        <div className="p-6">
                            {/* Plan Name */}
                            <h3 className="text-xl font-bold text-hud-text-primary">{plan.name}</h3>
                            <p className="text-sm text-hud-text-muted mt-1">{plan.description}</p>

                            {/* Price */}
                            <div className="my-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-hud-accent-primary font-mono">${plan.price}</span>
                                    <span className="text-hud-text-muted">/month</span>
                                </div>
                            </div>

                            {/* CTA */}
                            <Button
                                variant={plan.popular ? 'primary' : 'outline'}
                                fullWidth
                                glow={plan.popular}
                            >
                                {plan.price === 0 ? 'Get Started Free' : 'Start Free Trial'}
                            </Button>

                            {/* Features */}
                            <div className="mt-6 space-y-3">
                                {plan.features.map((feature) => (
                                    <div key={feature} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-hud-accent-success/10 flex items-center justify-center">
                                            <Check size={12} className="text-hud-accent-success" />
                                        </div>
                                        <span className="text-sm text-hud-text-secondary">{feature}</span>
                                    </div>
                                ))}
                                {plan.notIncluded.map((feature) => (
                                    <div key={feature} className="flex items-center gap-3 opacity-50">
                                        <div className="w-5 h-5 rounded-full bg-hud-bg-hover flex items-center justify-center">
                                            <span className="text-xs text-hud-text-muted">—</span>
                                        </div>
                                        <span className="text-sm text-hud-text-muted">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* FAQ Section */}
            <HudCard title="Frequently Asked Questions" className="max-w-3xl mx-auto">
                <div className="space-y-4">
                    {[
                        { q: 'Can I cancel my subscription anytime?', a: 'Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.' },
                        { q: 'Is there a free trial available?', a: 'Yes! All paid plans come with a 14-day free trial. No credit card required.' },
                        { q: 'Can I switch plans later?', a: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately.' },
                        { q: 'Do you offer discounts for teams?', a: 'Yes, we offer volume discounts for teams of 10 or more. Contact our sales team for more information.' },
                    ].map((faq, i) => (
                        <div key={i} className="p-4 bg-hud-bg-primary rounded-lg">
                            <h4 className="font-medium text-hud-text-primary">{faq.q}</h4>
                            <p className="text-sm text-hud-text-secondary mt-2">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </HudCard>

            {/* Contact */}
            <div className="text-center">
                <p className="text-hud-text-secondary">
                    Need a custom plan? <a href="#" className="text-hud-accent-primary hover:underline">Contact our sales team</a>
                </p>
            </div>
        </div>
    )
}

export default Pricing
