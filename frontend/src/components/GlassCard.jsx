import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const GlassCard = ({ children, className = '', delay = 0, noPadding = false, hover = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay }}
      className={cn(
        "glass-panel rounded-2xl relative overflow-hidden",
        !noPadding && "p-6",
        hover && "transition-transform hover:translate-y-[-2px] hover:shadow-lg",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
