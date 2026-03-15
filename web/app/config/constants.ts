import { Spring, Tween } from "framer-motion";

export const TRANSITIONS = {
    spring: {
        type: "spring",
        damping: 30,
        stiffness: 300,
    } as Spring,
    gentle: {
        type: "spring",
        damping: 25,
        stiffness: 200,
    } as Spring,
    quick: {
        type: "spring",
        damping: 20,
        stiffness: 400,
    } as Spring,
    fade: {
        type: "tween",
        duration: 0.2,
        ease: "easeInOut"
    } as Tween
};

export const BREAKPOINTS = {
    mobile: 640,
    tablet: 768,
    desktop: 1024,
};
