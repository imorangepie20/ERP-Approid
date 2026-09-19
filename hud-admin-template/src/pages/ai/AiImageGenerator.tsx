import { useState } from 'react'
import { Image, Wand2, Download, RefreshCw, Sparkles, Sliders } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

const stylePresets = [
    'Photorealistic',
    'Digital Art',
    'Anime',
    'Oil Painting',
    'Watercolor',
    'Sketch',
    '3D Render',
    'Cyberpunk',
]

const aspectRatios = [
    { label: '1:1', value: '1:1' },
    { label: '16:9', value: '16:9' },
    { label: '9:16', value: '9:16' },
    { label: '4:3', value: '4:3' },
]

const sampleImages = [
    { id: 1, prompt: 'Futuristic cityscape at night with neon lights', style: 'Cyberpunk' },
    { id: 2, prompt: 'Serene mountain landscape at sunset', style: 'Photorealistic' },
    { id: 3, prompt: 'Magical forest with glowing creatures', style: 'Digital Art' },
    { id: 4, prompt: 'Abstract geometric patterns in blue and gold', style: '3D Render' },
]

const AiImageGenerator = () => {
    const [prompt, setPrompt] = useState('')
    const [selectedStyle, setSelectedStyle] = useState('Photorealistic')
    const [selectedRatio, setSelectedRatio] = useState('1:1')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedImages, setGeneratedImages] = useState<typeof sampleImages>([])

    const handleGenerate = () => {
        if (!prompt.trim()) return

        setIsGenerating(true)
        setTimeout(() => {
            setGeneratedImages([
                { id: Date.now(), prompt, style: selectedStyle },
                ...generatedImages,
            ])
            setIsGenerating(false)
        }, 2000)
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary flex items-center gap-2">
                    <Image className="text-hud-accent-secondary" size={24} />
                    AI Image Generator
                </h1>
                <p className="text-hud-text-muted mt-1">Create stunning images from text descriptions.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Panel */}
                <div className="space-y-6">
                    <HudCard title="Create Image">
                        {/* Prompt */}
                        <div className="mb-4">
                            <label className="block text-sm text-hud-text-secondary mb-2">Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe the image you want to create..."
                                rows={4}
                                className="w-full px-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud resize-none"
                            />
                        </div>

                        {/* Style */}
                        <div className="mb-4">
                            <label className="block text-sm text-hud-text-secondary mb-2">Style</label>
                            <div className="flex flex-wrap gap-2">
                                {stylePresets.map((style) => (
                                    <button
                                        key={style}
                                        onClick={() => setSelectedStyle(style)}
                                        className={`px-3 py-1.5 text-xs rounded-lg transition-hud ${selectedStyle === style
                                                ? 'bg-hud-accent-primary text-hud-bg-primary'
                                                : 'bg-hud-bg-primary text-hud-text-secondary hover:text-hud-text-primary'
                                            }`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Aspect Ratio */}
                        <div className="mb-6">
                            <label className="block text-sm text-hud-text-secondary mb-2">Aspect Ratio</label>
                            <div className="flex gap-2">
                                {aspectRatios.map((ratio) => (
                                    <button
                                        key={ratio.value}
                                        onClick={() => setSelectedRatio(ratio.value)}
                                        className={`px-4 py-2 text-sm rounded-lg transition-hud ${selectedRatio === ratio.value
                                                ? 'bg-hud-accent-primary text-hud-bg-primary'
                                                : 'bg-hud-bg-primary text-hud-text-secondary hover:text-hud-text-primary'
                                            }`}
                                    >
                                        {ratio.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate Button */}
                        <Button
                            variant="primary"
                            fullWidth
                            glow
                            leftIcon={isGenerating ? <RefreshCw size={18} className="animate-spin" /> : <Wand2 size={18} />}
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                        >
                            {isGenerating ? 'Generating...' : 'Generate Image'}
                        </Button>
                    </HudCard>

                    {/* Settings */}
                    <HudCard title="Advanced Settings" action={<Sliders size={16} className="text-hud-accent-primary" />}>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-hud-text-secondary">Quality</span>
                                    <span className="text-hud-text-primary">High</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    defaultValue="3"
                                    className="w-full accent-hud-accent-primary"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-hud-text-secondary">Creativity</span>
                                    <span className="text-hud-text-primary">75%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    defaultValue="75"
                                    className="w-full accent-hud-accent-primary"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-hud-text-secondary">Number of Images</span>
                                    <span className="text-hud-text-primary">4</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="8"
                                    defaultValue="4"
                                    className="w-full accent-hud-accent-primary"
                                />
                            </div>
                        </div>
                    </HudCard>
                </div>

                {/* Gallery */}
                <HudCard title="Generated Images" subtitle="Your creations" className="lg:col-span-2" noPadding>
                    {generatedImages.length === 0 && sampleImages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-20 h-20 rounded-full bg-hud-accent-primary/10 flex items-center justify-center mb-4">
                                <Sparkles size={32} className="text-hud-accent-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-hud-text-primary">No images yet</h3>
                            <p className="text-sm text-hud-text-muted mt-2 max-w-sm">
                                Enter a prompt and click generate to create your first AI image.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 p-5">
                            {[...generatedImages, ...sampleImages].map((image) => (
                                <div
                                    key={image.id}
                                    className="group relative aspect-square bg-gradient-to-br from-hud-accent-primary/20 via-hud-accent-info/20 to-hud-accent-secondary/20 rounded-lg overflow-hidden"
                                >
                                    {/* Placeholder gradient for demo */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Image size={48} className="text-hud-text-muted/30" />
                                    </div>

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="absolute bottom-0 left-0 right-0 p-4">
                                            <p className="text-sm text-white line-clamp-2">{image.prompt}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-hud-accent-primary">{image.style}</span>
                                                <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-hud">
                                                    <Download size={16} className="text-white" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </HudCard>
            </div>
        </div>
    )
}

export default AiImageGenerator
