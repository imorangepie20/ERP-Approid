import { useState } from 'react'
import { Check, ChevronRight, User, Building, CreditCard, FileCheck } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const steps = [
    { id: 1, title: 'Personal Info', icon: <User size={20} /> },
    { id: 2, title: 'Company Details', icon: <Building size={20} /> },
    { id: 3, title: 'Payment', icon: <CreditCard size={20} /> },
    { id: 4, title: 'Confirmation', icon: <FileCheck size={20} /> },
]

const FormWizards = () => {
    const [currentStep, setCurrentStep] = useState(1)
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        website: '',
        employees: '',
        cardNumber: '',
        expiry: '',
        cvv: '',
    })

    const nextStep = () => {
        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        }
    }

    const handleInputChange = (field: string, value: string) => {
        setFormData({ ...formData, [field]: value })
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Form Wizards</h1>
                <p className="text-hud-text-muted mt-1">Multi-step form with progress indicators.</p>
            </div>

            {/* Horizontal Wizard */}
            <HudCard title="Multi-Step Form" subtitle="Complete all steps to submit">
                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-8">
                    {steps.map((step, i) => (
                        <div key={step.id} className="flex items-center">
                            <div
                                className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-hud ${currentStep > step.id
                                        ? 'bg-hud-accent-success border-hud-accent-success text-white'
                                        : currentStep === step.id
                                            ? 'bg-hud-accent-primary border-hud-accent-primary text-hud-bg-primary'
                                            : 'border-hud-border-secondary text-hud-text-muted'
                                    }`}
                            >
                                {currentStep > step.id ? <Check size={20} /> : step.icon}
                            </div>
                            <div className="ml-3 hidden md:block">
                                <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-hud-text-primary' : 'text-hud-text-muted'
                                    }`}>
                                    Step {step.id}
                                </p>
                                <p className={`text-xs ${currentStep >= step.id ? 'text-hud-accent-primary' : 'text-hud-text-muted'
                                    }`}>
                                    {step.title}
                                </p>
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`w-16 md:w-24 h-0.5 mx-4 ${currentStep > step.id ? 'bg-hud-accent-success' : 'bg-hud-border-secondary'
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="min-h-[300px]">
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-hud-text-primary">Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">First Name</label>
                                    <input
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                                        placeholder="Enter first name"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                                        placeholder="Enter last name"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        placeholder="email@example.com"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                        placeholder="+1 (555) 123-4567"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-hud-text-primary">Company Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Company Name</label>
                                    <input
                                        type="text"
                                        value={formData.company}
                                        onChange={(e) => handleInputChange('company', e.target.value)}
                                        placeholder="Enter company name"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Website</label>
                                    <input
                                        type="url"
                                        value={formData.website}
                                        onChange={(e) => handleInputChange('website', e.target.value)}
                                        placeholder="https://example.com"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm text-hud-text-secondary mb-2">Number of Employees</label>
                                    <select
                                        value={formData.employees}
                                        onChange={(e) => handleInputChange('employees', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    >
                                        <option value="">Select range</option>
                                        <option value="1-10">1-10</option>
                                        <option value="11-50">11-50</option>
                                        <option value="51-200">51-200</option>
                                        <option value="201-500">201-500</option>
                                        <option value="500+">500+</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-hud-text-primary">Payment Information</h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Card Number</label>
                                    <input
                                        type="text"
                                        value={formData.cardNumber}
                                        onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                                        placeholder="1234 5678 9012 3456"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud font-mono"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm text-hud-text-secondary mb-2">Expiry Date</label>
                                        <input
                                            type="text"
                                            value={formData.expiry}
                                            onChange={(e) => handleInputChange('expiry', e.target.value)}
                                            placeholder="MM/YY"
                                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-hud-text-secondary mb-2">CVV</label>
                                        <input
                                            type="text"
                                            value={formData.cvv}
                                            onChange={(e) => handleInputChange('cvv', e.target.value)}
                                            placeholder="123"
                                            className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-6 animate-fade-in text-center">
                            <div className="w-20 h-20 mx-auto rounded-full bg-hud-accent-success/10 flex items-center justify-center">
                                <Check size={40} className="text-hud-accent-success" />
                            </div>
                            <h3 className="text-xl font-semibold text-hud-text-primary">Confirmation</h3>
                            <p className="text-hud-text-secondary max-w-md mx-auto">
                                Please review your information before submitting. Once submitted, you will receive
                                a confirmation email.
                            </p>
                            <div className="bg-hud-bg-primary rounded-lg p-6 text-left max-w-md mx-auto">
                                <h4 className="font-medium text-hud-text-primary mb-3">Summary</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-hud-text-muted">Name:</span>
                                        <span className="text-hud-text-primary">{formData.firstName} {formData.lastName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-hud-text-muted">Email:</span>
                                        <span className="text-hud-text-primary">{formData.email || 'Not provided'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-hud-text-muted">Company:</span>
                                        <span className="text-hud-text-primary">{formData.company || 'Not provided'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-hud-text-muted">Card:</span>
                                        <span className="text-hud-text-primary font-mono">
                                            **** **** **** {formData.cardNumber.slice(-4) || '****'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-8 pt-6 border-t border-hud-border-secondary">
                    <Button
                        variant="ghost"
                        onClick={prevStep}
                        disabled={currentStep === 1}
                    >
                        Previous
                    </Button>
                    {currentStep < steps.length ? (
                        <Button
                            variant="primary"
                            glow
                            onClick={nextStep}
                            rightIcon={<ChevronRight size={16} />}
                        >
                            Next Step
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            glow
                            leftIcon={<Check size={16} />}
                        >
                            Submit
                        </Button>
                    )}
                </div>
            </HudCard>

            {/* Vertical Wizard */}
            <HudCard title="Vertical Steps" subtitle="Alternative vertical layout">
                <div className="flex gap-8">
                    <div className="space-y-4">
                        {steps.map((step, i) => (
                            <div key={step.id} className="flex items-start gap-4">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${i < 2
                                                ? 'bg-hud-accent-success border-hud-accent-success text-white'
                                                : i === 2
                                                    ? 'bg-hud-accent-primary border-hud-accent-primary text-hud-bg-primary'
                                                    : 'border-hud-border-secondary text-hud-text-muted'
                                            }`}
                                    >
                                        {i < 2 ? <Check size={16} /> : step.icon}
                                    </div>
                                    {i < steps.length - 1 && (
                                        <div className={`w-0.5 h-12 ${i < 2 ? 'bg-hud-accent-success' : 'bg-hud-border-secondary'}`} />
                                    )}
                                </div>
                                <div className="pb-8">
                                    <p className={`font-medium ${i <= 2 ? 'text-hud-text-primary' : 'text-hud-text-muted'}`}>
                                        {step.title}
                                    </p>
                                    <p className="text-sm text-hud-text-muted mt-1">
                                        {i < 2 ? 'Completed' : i === 2 ? 'In progress' : 'Pending'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </HudCard>
        </div>
    )
}

export default FormWizards
