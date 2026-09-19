import {
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Briefcase,
    Link as LinkIcon,
    Edit,
    Camera,
    Github,
    Twitter,
    Linkedin,
} from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'

const skills = [
    { name: 'React', level: 95 },
    { name: 'TypeScript', level: 90 },
    { name: 'Node.js', level: 85 },
    { name: 'Python', level: 75 },
    { name: 'AWS', level: 70 },
]

const projects = [
    { name: 'E-Commerce Platform', status: 'Completed', progress: 100 },
    { name: 'Mobile App Redesign', status: 'In Progress', progress: 65 },
    { name: 'Analytics Dashboard', status: 'In Progress', progress: 45 },
    { name: 'API Integration', status: 'Pending', progress: 0 },
]

const activities = [
    { action: 'Pushed 3 commits to main branch', time: '2 hours ago' },
    { action: 'Completed task: API Documentation', time: '5 hours ago' },
    { action: 'Commented on issue #234', time: '1 day ago' },
    { action: 'Created new branch: feature/auth', time: '2 days ago' },
    { action: 'Reviewed pull request #89', time: '3 days ago' },
]

const Profile = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Profile Header */}
            <HudCard>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* Avatar */}
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-hud-accent-primary via-hud-accent-info to-hud-accent-secondary p-1">
                            <div className="w-full h-full rounded-full bg-hud-bg-secondary flex items-center justify-center">
                                <User size={48} className="text-hud-accent-primary" />
                            </div>
                        </div>
                        <button className="absolute bottom-0 right-0 p-2 bg-hud-accent-primary rounded-full text-hud-bg-primary hover:bg-hud-accent-primary/90 transition-hud">
                            <Camera size={16} />
                        </button>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-hud-text-primary">Admin User</h1>
                                <p className="text-hud-text-muted mt-1">Senior Full Stack Developer</p>
                            </div>
                            <Button variant="outline" leftIcon={<Edit size={16} />}>
                                Edit Profile
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                            <div className="flex items-center gap-2 text-hud-text-secondary">
                                <Mail size={16} className="text-hud-accent-primary" />
                                <span className="text-sm">admin@hudadmin.com</span>
                            </div>
                            <div className="flex items-center gap-2 text-hud-text-secondary">
                                <Phone size={16} className="text-hud-accent-primary" />
                                <span className="text-sm">+1 (555) 123-4567</span>
                            </div>
                            <div className="flex items-center gap-2 text-hud-text-secondary">
                                <MapPin size={16} className="text-hud-accent-primary" />
                                <span className="text-sm">San Francisco, CA</span>
                            </div>
                            <div className="flex items-center gap-2 text-hud-text-secondary">
                                <Calendar size={16} className="text-hud-accent-primary" />
                                <span className="text-sm">Joined Jan 2024</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-hud-border-secondary">
                    {[
                        { label: 'Projects', value: '24' },
                        { label: 'Tasks Completed', value: '1,842' },
                        { label: 'Commits', value: '3,291' },
                        { label: 'Reviews', value: '156' },
                    ].map((stat) => (
                        <div key={stat.label} className="text-center">
                            <p className="text-2xl font-bold text-hud-accent-primary font-mono">{stat.value}</p>
                            <p className="text-sm text-hud-text-muted mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </HudCard>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* About */}
                <HudCard title="About" className="lg:col-span-2">
                    <p className="text-hud-text-secondary leading-relaxed">
                        Passionate full-stack developer with 8+ years of experience building scalable web applications.
                        Specialized in React, Node.js, and cloud technologies. Strong advocate for clean code,
                        test-driven development, and continuous learning. Currently focused on building innovative
                        solutions that make a positive impact.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="flex items-center gap-3">
                            <Briefcase size={18} className="text-hud-accent-primary" />
                            <div>
                                <p className="text-sm text-hud-text-muted">Company</p>
                                <p className="text-sm text-hud-text-primary">TechCorp Inc.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <LinkIcon size={18} className="text-hud-accent-primary" />
                            <div>
                                <p className="text-sm text-hud-text-muted">Website</p>
                                <a href="#" className="text-sm text-hud-accent-primary hover:underline">www.portfolio.dev</a>
                            </div>
                        </div>
                    </div>

                    {/* Social Links */}
                    <div className="flex items-center gap-3 mt-6 pt-6 border-t border-hud-border-secondary">
                        <a href="#" className="p-2 rounded-lg bg-hud-bg-primary hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                            <Github size={20} />
                        </a>
                        <a href="#" className="p-2 rounded-lg bg-hud-bg-primary hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                            <Twitter size={20} />
                        </a>
                        <a href="#" className="p-2 rounded-lg bg-hud-bg-primary hover:bg-hud-bg-hover text-hud-text-secondary hover:text-hud-text-primary transition-hud">
                            <Linkedin size={20} />
                        </a>
                    </div>
                </HudCard>

                {/* Skills */}
                <HudCard title="Skills">
                    <div className="space-y-4">
                        {skills.map((skill) => (
                            <div key={skill.name}>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span className="text-hud-text-secondary">{skill.name}</span>
                                    <span className="text-hud-text-primary font-mono">{skill.level}%</span>
                                </div>
                                <div className="h-2 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-hud-accent-primary to-hud-accent-info rounded-full transition-all duration-500"
                                        style={{ width: `${skill.level}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Projects */}
                <HudCard title="Projects" subtitle="Current assignments" noPadding>
                    <div className="divide-y divide-hud-border-secondary">
                        {projects.map((project) => (
                            <div key={project.name} className="px-5 py-4 hover:bg-hud-bg-hover transition-hud">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-hud-text-primary">{project.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${project.status === 'Completed' ? 'bg-hud-accent-success/10 text-hud-accent-success' :
                                            project.status === 'In Progress' ? 'bg-hud-accent-info/10 text-hud-accent-info' :
                                                'bg-hud-bg-hover text-hud-text-muted'
                                        }`}>
                                        {project.status}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-hud-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${project.status === 'Completed' ? 'bg-hud-accent-success' :
                                                project.status === 'In Progress' ? 'bg-hud-accent-info' :
                                                    'bg-hud-text-muted'
                                            }`}
                                        style={{ width: `${project.progress}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </HudCard>

                {/* Activity */}
                <HudCard title="Recent Activity" subtitle="Latest actions" noPadding>
                    <div className="divide-y divide-hud-border-secondary">
                        {activities.map((item, i) => (
                            <div key={i} className="px-5 py-4 hover:bg-hud-bg-hover transition-hud">
                                <p className="text-sm text-hud-text-primary">{item.action}</p>
                                <p className="text-xs text-hud-text-muted mt-1">{item.time}</p>
                            </div>
                        ))}
                    </div>
                </HudCard>
            </div>
        </div>
    )
}

export default Profile
