import React from 'react';
import { motion } from 'framer-motion';

interface PremiumCardProps {
  title: string;
  value: string | number;
  change?: number; // percentage change
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'warning' | 'default';
}

const variantClasses: Record<string, string> = {
  primary: 'text-hud-accent-primary border-hud-accent-primary/20',
  secondary: 'text-hud-accent-secondary border-hud-accent-secondary/20',
  warning: 'text-hud-accent-warning border-hud-accent-warning/20',
  default: 'text-hud-text-primary border-hud-border-secondary',
};

const variantIconBg: Record<string, string> = {
  primary: 'bg-hud-accent-primary/10',
  secondary: 'bg-hud-accent-secondary/10',
  warning: 'bg-hud-accent-warning/10',
  default: 'bg-hud-bg-hover',
};

const PremiumCard: React.FC<PremiumCardProps> = ({ title, value, change, icon, variant = 'default' }) => {
  const changeColor = change && change > 0 ? 'text-hud-accent-success' : change && change < 0 ? 'text-hud-accent-danger' : '';
  const changeSign = change && change > 0 ? '+' : '';

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative p-5 rounded-xl border backdrop-blur-lg bg-hud-bg-card ${variantClasses[variant]} shadow-hud transition-hud`}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-hud-accent-primary/5 to-transparent pointer-events-none" />

      <div className="relative flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-hud-text-muted">{title}</h3>
        <div className={`p-2 rounded-lg ${variantIconBg[variant]}`}>
          {icon}
        </div>
      </div>
      <div className="relative text-2xl font-bold text-hud-text-primary mb-1 font-mono">{value}</div>
      {typeof change === 'number' && (
        <div className={`relative text-sm font-medium ${changeColor}`}>
          {changeSign}{change}%
          <span className="text-hud-text-muted text-xs ml-1">vs last month</span>
        </div>
      )}
    </motion.div>
  );
};

export default PremiumCard;
