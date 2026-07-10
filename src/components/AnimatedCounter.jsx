import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';

const AnimatedCounter = ({ value, duration = 2, suffix = '', prefix = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  
  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });
  
  const display = useTransform(spring, (current) => {
    return `${prefix}${Math.round(current).toLocaleString()}${suffix}`;
  });
  
  const [displayValue, setDisplayValue] = useState(`${prefix}0${suffix}`);
  
  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, value, spring]);
  
  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      setDisplayValue(v);
    });
    return unsubscribe;
  }, [display]);
  
  return (
    <motion.span
      ref={ref}
      className="stat-number"
    >
      {displayValue}
    </motion.span>
  );
};

export default AnimatedCounter;
