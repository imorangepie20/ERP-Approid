import HudCard from '../../components/common/HudCard'

const UiTypography = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">Typography</h1>
                <p className="text-hud-text-muted mt-1">Text styles and formatting options.</p>
            </div>

            {/* Headings */}
            <HudCard title="Headings" subtitle="Different heading sizes">
                <div className="space-y-4">
                    <h1 className="text-5xl font-bold text-hud-text-primary">Heading 1</h1>
                    <h2 className="text-4xl font-bold text-hud-text-primary">Heading 2</h2>
                    <h3 className="text-3xl font-bold text-hud-text-primary">Heading 3</h3>
                    <h4 className="text-2xl font-semibold text-hud-text-primary">Heading 4</h4>
                    <h5 className="text-xl font-semibold text-hud-text-primary">Heading 5</h5>
                    <h6 className="text-lg font-semibold text-hud-text-primary">Heading 6</h6>
                </div>
            </HudCard>

            {/* Display Headings */}
            <HudCard title="Display Headings" subtitle="Extra large headings for hero sections">
                <div className="space-y-4">
                    <h1 className="text-6xl font-bold text-hud-text-primary">Display 1</h1>
                    <h2 className="text-5xl font-bold text-hud-text-primary">Display 2</h2>
                    <h3 className="text-4xl font-bold text-hud-text-primary">Display 3</h3>
                </div>
            </HudCard>

            {/* Paragraphs */}
            <HudCard title="Paragraphs" subtitle="Body text styles">
                <div className="space-y-4">
                    <p className="text-lg text-hud-text-primary leading-relaxed">
                        <strong>Lead paragraph:</strong> This is a lead paragraph. It stands out from regular paragraphs
                        with larger text and more line height for better readability.
                    </p>
                    <p className="text-base text-hud-text-secondary leading-relaxed">
                        <strong>Regular paragraph:</strong> This is a regular paragraph. It uses the default body text size
                        and is suitable for most content. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                    </p>
                    <p className="text-sm text-hud-text-muted leading-relaxed">
                        <strong>Small paragraph:</strong> This is a smaller paragraph. It's useful for captions, footnotes,
                        or secondary information that doesn't need to stand out.
                    </p>
                </div>
            </HudCard>

            {/* Inline Text */}
            <HudCard title="Inline Text Elements" subtitle="Common inline text formatting">
                <div className="space-y-3">
                    <p className="text-hud-text-secondary">
                        You can use <mark className="bg-hud-accent-warning/30 text-hud-text-primary px-1 rounded">highlight text</mark> to draw attention.
                    </p>
                    <p className="text-hud-text-secondary">
                        <del>This line of text is meant to be treated as deleted text.</del>
                    </p>
                    <p className="text-hud-text-secondary">
                        <s>This line of text is meant to be treated as no longer accurate.</s>
                    </p>
                    <p className="text-hud-text-secondary">
                        <ins className="underline decoration-hud-accent-primary">This line of text is meant to be treated as an addition.</ins>
                    </p>
                    <p className="text-hud-text-secondary">
                        <u>This line of text will render as underlined.</u>
                    </p>
                    <p className="text-hud-text-secondary">
                        <small className="text-sm">This line of text is meant to be treated as fine print.</small>
                    </p>
                    <p className="text-hud-text-secondary">
                        <strong>This line rendered as bold text.</strong>
                    </p>
                    <p className="text-hud-text-secondary">
                        <em>This line rendered as italicized text.</em>
                    </p>
                </div>
            </HudCard>

            {/* Font Weights */}
            <HudCard title="Font Weights" subtitle="Available font weight options">
                <div className="space-y-2">
                    <p className="font-light text-lg text-hud-text-primary">Font Weight 300 - Light</p>
                    <p className="font-normal text-lg text-hud-text-primary">Font Weight 400 - Normal</p>
                    <p className="font-medium text-lg text-hud-text-primary">Font Weight 500 - Medium</p>
                    <p className="font-semibold text-lg text-hud-text-primary">Font Weight 600 - Semibold</p>
                    <p className="font-bold text-lg text-hud-text-primary">Font Weight 700 - Bold</p>
                </div>
            </HudCard>

            {/* Text Colors */}
            <HudCard title="Text Colors" subtitle="Themed color options">
                <div className="space-y-2">
                    <p className="text-hud-text-primary">Primary Text Color</p>
                    <p className="text-hud-text-secondary">Secondary Text Color</p>
                    <p className="text-hud-text-muted">Muted Text Color</p>
                    <p className="text-hud-accent-primary">Primary Accent Color</p>
                    <p className="text-hud-accent-secondary">Secondary Accent Color</p>
                    <p className="text-hud-accent-success">Success Color</p>
                    <p className="text-hud-accent-warning">Warning Color</p>
                    <p className="text-hud-accent-danger">Danger Color</p>
                    <p className="text-hud-accent-info">Info Color</p>
                </div>
            </HudCard>

            {/* Blockquote */}
            <HudCard title="Blockquotes" subtitle="Quote styling">
                <div className="space-y-6">
                    <blockquote className="border-l-4 border-hud-accent-primary pl-4 py-2">
                        <p className="text-lg text-hud-text-primary italic">
                            "The only way to do great work is to love what you do."
                        </p>
                        <footer className="text-sm text-hud-text-muted mt-2">
                            — Steve Jobs
                        </footer>
                    </blockquote>

                    <blockquote className="bg-hud-bg-primary rounded-lg p-4 border-l-4 border-hud-accent-info">
                        <p className="text-hud-text-secondary">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante.
                        </p>
                        <footer className="text-sm text-hud-accent-info mt-2">
                            — Someone famous
                        </footer>
                    </blockquote>
                </div>
            </HudCard>

            {/* Lists */}
            <HudCard title="Lists" subtitle="Ordered and unordered lists">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-hud-text-primary mb-3">Unordered List</h4>
                        <ul className="list-disc list-inside space-y-1 text-hud-text-secondary">
                            <li>Lorem ipsum dolor sit amet</li>
                            <li>Consectetur adipiscing elit</li>
                            <li>Integer molestie lorem at massa
                                <ul className="list-circle list-inside ml-4 mt-1 space-y-1">
                                    <li>Nested list item</li>
                                    <li>Another nested item</li>
                                </ul>
                            </li>
                            <li>Facilisis in pretium nisl aliquet</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-hud-text-primary mb-3">Ordered List</h4>
                        <ol className="list-decimal list-inside space-y-1 text-hud-text-secondary">
                            <li>Lorem ipsum dolor sit amet</li>
                            <li>Consectetur adipiscing elit</li>
                            <li>Integer molestie lorem at massa</li>
                            <li>Facilisis in pretium nisl aliquet</li>
                            <li>Nulla volutpat aliquam velit</li>
                        </ol>
                    </div>
                </div>
            </HudCard>

            {/* Code */}
            <HudCard title="Code" subtitle="Inline and block code">
                <div className="space-y-4">
                    <p className="text-hud-text-secondary">
                        For example, <code className="px-1.5 py-0.5 bg-hud-bg-primary rounded text-hud-accent-primary font-mono text-sm">&lt;section&gt;</code> should be wrapped as inline.
                    </p>

                    <pre className="bg-hud-bg-primary rounded-lg p-4 overflow-x-auto">
                        <code className="text-sm font-mono text-hud-text-primary">
                            {`function greet(name: string) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));`}
                        </code>
                    </pre>
                </div>
            </HudCard>

            {/* Monospace */}
            <HudCard title="Monospace Numbers" subtitle="Fixed-width numbers for data display">
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        <span className="text-hud-text-muted w-24">Default:</span>
                        <span className="text-2xl text-hud-text-primary">$1,234,567.89</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-hud-text-muted w-24">Monospace:</span>
                        <span className="text-2xl text-hud-text-primary font-mono">$1,234,567.89</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-hud-text-muted w-24">Accent:</span>
                        <span className="text-2xl text-hud-accent-primary font-mono">$1,234,567.89</span>
                    </div>
                </div>
            </HudCard>
        </div>
    )
}

export default UiTypography
