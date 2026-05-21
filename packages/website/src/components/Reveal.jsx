import { motion } from 'framer-motion';

const ease = [0.33, 1, 0.68, 1];

export default function Reveal({
  children,
  className = '',
  delay = 0,
  y = 28,
  once = true,
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.65, delay, ease }}
    >
      {children}
    </motion.div>
  );
}
