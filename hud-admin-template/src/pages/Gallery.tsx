import { useState } from 'react'
import { X, ZoomIn, Download, Heart, Share2 } from 'lucide-react'
import HudCard from '../components/common/HudCard'

const galleryItems = [
    { id: 1, title: 'Mountain Landscape', category: 'Nature', color: 'from-blue-500 to-cyan-400' },
    { id: 2, title: 'City Skyline', category: 'Urban', color: 'from-purple-500 to-pink-400' },
    { id: 3, title: 'Ocean Sunset', category: 'Nature', color: 'from-orange-500 to-red-400' },
    { id: 4, title: 'Forest Path', category: 'Nature', color: 'from-green-500 to-emerald-400' },
    { id: 5, title: 'Abstract Art', category: 'Art', color: 'from-pink-500 to-violet-400' },
    { id: 6, title: 'Night City', category: 'Urban', color: 'from-indigo-500 to-blue-400' },
    { id: 7, title: 'Desert Dunes', category: 'Nature', color: 'from-yellow-500 to-orange-400' },
    { id: 8, title: 'Street Photography', category: 'Urban', color: 'from-gray-500 to-slate-400' },
    { id: 9, title: 'Wildlife', category: 'Nature', color: 'from-lime-500 to-green-400' },
    { id: 10, title: 'Architecture', category: 'Urban', color: 'from-rose-500 to-pink-400' },
    { id: 11, title: 'Minimalist', category: 'Art', color: 'from-slate-400 to-gray-500' },
    { id: 12, title: 'Portrait', category: 'People', color: 'from-amber-500 to-yellow-400' },
]

const categories = ['All', 'Nature', 'Urban', 'Art', 'People']

const Gallery = () => {
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [selectedImage, setSelectedImage] = useState<typeof galleryItems[0] | null>(null)

    const filteredItems = galleryItems.filter(
        item => selectedCategory === 'All' || item.category === selectedCategory
    )

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Gallery</h1>
                <p className="text-hud-text-muted mt-1">A beautiful image gallery with lightbox.</p>
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-hud ${selectedCategory === cat
                                ? 'bg-hud-accent-primary text-hud-bg-primary'
                                : 'bg-hud-bg-secondary text-hud-text-secondary hover:text-hud-text-primary'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => setSelectedImage(item)}
                        className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer hud-card hud-card-bottom"
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-80`} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl">🖼️</span>
                        </div>

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                            <button className="p-3 bg-hud-accent-primary rounded-full text-hud-bg-primary">
                                <ZoomIn size={20} />
                            </button>
                            <p className="text-sm text-white font-medium">{item.title}</p>
                            <span className="text-xs text-white/60">{item.category}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Lightbox */}
            {selectedImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                        onClick={() => setSelectedImage(null)}
                    />
                    <div className="relative max-w-4xl w-full animate-fade-in">
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white transition-hud"
                        >
                            <X size={24} />
                        </button>

                        {/* Image */}
                        <div className={`aspect-video rounded-lg overflow-hidden bg-gradient-to-br ${selectedImage.color}`}>
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-8xl">🖼️</span>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="mt-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-semibold text-white">{selectedImage.title}</h3>
                                <p className="text-sm text-white/60">{selectedImage.category}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-hud">
                                    <Heart size={20} />
                                </button>
                                <button className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-hud">
                                    <Share2 size={20} />
                                </button>
                                <button className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-hud">
                                    <Download size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Gallery
