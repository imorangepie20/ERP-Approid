import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Copy, RefreshCw, Sparkles } from 'lucide-react'
import HudCard from '../../components/common/HudCard'
import Button from '../../components/common/Button'

interface Message {
    id: number
    role: 'user' | 'assistant'
    content: string
    timestamp: string
}

const sampleResponses = [
    "I'd be happy to help you with that! Based on your request, here's what I recommend...",
    "That's a great question! Let me break this down for you step by step.",
    "I've analyzed your request and here are my findings. First, let's consider the key factors...",
    "Here's a comprehensive solution for your problem. The approach involves several components...",
]

const AiChat = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            role: 'assistant',
            content: "Hello! I'm your AI assistant. How can I help you today? I can assist with coding, writing, analysis, and much more.",
            timestamp: '10:00 AM',
        },
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSend = () => {
        if (!input.trim()) return

        const userMessage: Message = {
            id: messages.length + 1,
            role: 'user',
            content: input,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setMessages([...messages, userMessage])
        setInput('')
        setIsTyping(true)

        // Simulate AI response
        setTimeout(() => {
            const aiResponse: Message = {
                id: messages.length + 2,
                role: 'assistant',
                content: sampleResponses[Math.floor(Math.random() * sampleResponses.length)],
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
            setMessages((prev) => [...prev, aiResponse])
            setIsTyping(false)
        }, 1500)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary flex items-center gap-2">
                        <Sparkles className="text-hud-accent-primary" size={24} />
                        AI Chat
                    </h1>
                    <p className="text-hud-text-muted mt-1">Chat with our advanced AI assistant.</p>
                </div>
                <Button variant="outline" leftIcon={<RefreshCw size={16} />}>
                    New Chat
                </Button>
            </div>

            {/* Chat Area */}
            <HudCard className="flex-1 flex flex-col overflow-hidden" noPadding>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user'
                                        ? 'bg-hud-accent-info'
                                        : 'bg-gradient-to-br from-hud-accent-primary to-hud-accent-secondary'
                                    }`}
                            >
                                {message.role === 'user' ? (
                                    <User size={18} className="text-white" />
                                ) : (
                                    <Bot size={18} className="text-hud-bg-primary" />
                                )}
                            </div>
                            <div className={`flex-1 max-w-2xl ${message.role === 'user' ? 'text-right' : ''}`}>
                                <div
                                    className={`inline-block p-4 rounded-2xl ${message.role === 'user'
                                            ? 'bg-hud-accent-info text-white rounded-tr-none'
                                            : 'bg-hud-bg-primary text-hud-text-primary rounded-tl-none'
                                        }`}
                                >
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-hud-text-muted">{message.timestamp}</span>
                                    {message.role === 'assistant' && (
                                        <button className="p-1 text-hud-text-muted hover:text-hud-accent-primary transition-hud">
                                            <Copy size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hud-accent-primary to-hud-accent-secondary flex items-center justify-center">
                                <Bot size={18} className="text-hud-bg-primary" />
                            </div>
                            <div className="bg-hud-bg-primary p-4 rounded-2xl rounded-tl-none">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-hud-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-hud-accent-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-hud-accent-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-hud-border-secondary">
                    <div className="flex gap-3">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your message..."
                            rows={1}
                            className="flex-1 px-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-xl text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud resize-none"
                        />
                        <Button
                            variant="primary"
                            glow
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping}
                        >
                            <Send size={18} />
                        </Button>
                    </div>
                    <p className="text-xs text-hud-text-muted mt-2 text-center">
                        AI responses are generated for demonstration purposes.
                    </p>
                </div>
            </HudCard>
        </div>
    )
}

export default AiChat
