import { motion } from 'motion/react';

// The full transform string stays on the compositor; the x/y/scale shorthands do not.
export const Card = () => (
  <motion.div
    animate={{ transform: 'translateX(100px)' }}
    transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
  />
);

// Deliberate near-misses that must NOT be flagged: a word that merely contains the letters
// "ease-in", and the ease-in-out token, which is the correct curve for on-screen movement.
export const releaseInfo = { channel: 'stable', curve: 'var(--ease-in-out)' };
