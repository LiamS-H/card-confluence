import { Box } from '@mui/material';
import { useEffect, useState } from 'react';

export default function ScrollProgress() {
    const [scrollProgress, setScrollProgress] = useState(0);
    useEffect(() => {
        const handleScroll = () => {
            const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
            const currentProgress = (window.scrollY / totalScroll) * 100;
            setScrollProgress(currentProgress);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                height: 2,
                bgcolor: 'success.main',
                zIndex: 50,
                width: `${scrollProgress}%`,
                transition: 'width 0.3s',
            }}
        />
    );
}
