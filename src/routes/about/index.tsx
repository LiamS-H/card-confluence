import { useEffect, useRef } from 'react';
import { Box, Container, Typography, Button, Paper, Grid } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExtensionIcon from '@mui/icons-material/Extension';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import './index.css';
import { useScryfallNewest } from '../../hooks/scryfall/search';
import MTGCardGrid from '../../components/mtg-card-grid';
import ScrollProgress from './scrollProgress';

const About = () => {
    const { data: newestCards } = useScryfallNewest();

    const features = [
        {
            title: 'Error Highlighting',
            description: 'Automatically parse errors and highlight incorrect filters.',
            icon: <CodeIcon sx={{ width: 48, height: 48, mb: 2, color: 'primary.main' }} />,
            animation: 'fade-right',
        },
        {
            title: 'Complex Query Organization',
            description: 'Build nested queries and organize complex filters visually.',
            icon: <AccountTreeIcon sx={{ width: 48, height: 48, mb: 2, color: 'primary.main' }} />,
            animation: 'fade-up',
        },
        {
            title: 'Custom Query Blocks',
            description: 'Group filters into blocks to rename and reuse with ease.',
            icon: <ExtensionIcon sx={{ width: 48, height: 48, mb: 2, color: 'primary.main' }} />,
            animation: 'fade-left',
        },
        {
            title: 'Infinite Scrolling',
            description: 'Browse seamlessly, without waiting page break.',
            icon: <AllInclusiveIcon sx={{ width: 48, height: 48, mb: 2, color: 'success.main' }} />,
            animation: 'zoom-in',
        },
    ];

    const sections = useRef<HTMLDivElement[]>([]);

    useEffect(() => {
        const observerOptions = {
            threshold: 0.5,
            rootMargin: '0px',
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        const elements = sections.current.filter(Boolean);
        elements.forEach((section) => {
            if (section) {
                const animation = section.dataset.animation || '';
                section.classList.add(animation);
                observer.observe(section);
            }
        });

        return () => observer.disconnect();
    }, []);

    return (
        <Box>
            {/* Progress bar */}
            <ScrollProgress />

            {/* Hero Section */}
            <Container sx={{ py: 20, pb: 40, textAlign: 'center' }}>
                <Box sx={{ position: 'relative', display: 'inline-block', mb: 3 }}>
                    <Typography
                        variant='h1'
                        sx={{
                            fontSize: '4rem',
                            fontWeight: 'bold',
                            position: 'relative',
                            zIndex: 1,
                        }}
                    >
                        Card Confluence
                    </Typography>
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: -8,
                            left: 0,
                            width: '100%',
                            height: 16,
                            bgcolor: 'success.light',
                            opacity: 0.5,
                            transform: 'rotate(-1deg)',
                        }}
                    />
                </Box>
                <Box>
                    <Button
                        href='/'
                        variant='contained'
                        sx={{
                            px: 4,
                            py: 2,
                            fontSize: '1.125rem',
                            '&:hover .searchIcon': {
                                transform: 'rotate(12deg)',
                            },
                        }}
                    >
                        Begin Your Search
                        <SearchIcon
                            className='searchIcon'
                            sx={{ ml: 1, transition: 'transform 0.3s' }}
                        />
                    </Button>
                </Box>

                {/*Keep Scrolling */}
                <Box sx={{ mt: 8, animation: 'pulse 2s infinite' }}>
                    <Typography sx={{ mb: 1, opacity: 0.75 }} variant='body2'>
                        Scroll to Explore
                    </Typography>
                    <KeyboardArrowDownIcon
                        sx={{
                            width: 32,
                            height: 32,
                            animation: 'bounce 1s infinite',
                        }}
                    />
                </Box>
            </Container>

            {/* Problem Statement */}
            <Box
                ref={(el) => (sections.current[0] = el as HTMLDivElement)}
                data-animation='fade-up'
                sx={{ textAlign: 'center', pb: 12 }}
            >
                <Typography variant='h2' sx={{ fontSize: '1.5rem', mb: 4, opacity: 0.75 }}>
                    Find the perfect card.
                </Typography>
                {newestCards ? <MTGCardGrid cards={newestCards} /> : null}
            </Box>

            {/* Features Grid */}
            <Container sx={{ pb: 12, textAlign: 'center' }}>
                <Box
                    data-animation='zoom-in'
                    ref={(el: HTMLDivElement) => (sections.current[1] = el)}
                >
                    <Typography variant='h2' sx={{ mb: 4, opacity: 0.75 }}>
                        Why Card Confluence?
                    </Typography>
                </Box>
                <Grid container spacing={6}>
                    {features.map((feature, index) => (
                        <Grid item xs={12} md={6} key={feature.title}>
                            <Paper
                                ref={(el: HTMLDivElement) => (sections.current[index + 2] = el)}
                                data-animation={feature.animation}
                                sx={{
                                    p: 4,
                                    height: '100%',
                                    transition: 'transform 0.3s',
                                    '&:hover': {
                                        boxShadow: 6,
                                        transform: 'translateY(-4px)',
                                    },
                                }}
                            >
                                <Box sx={{ textAlign: 'center' }}>
                                    {feature.icon}
                                    <Typography variant='h5' sx={{ mb: 2, fontWeight: 'bold' }}>
                                        {feature.title}
                                    </Typography>
                                    <Typography variant='body1' sx={{ opacity: 0.75 }}>
                                        {feature.description}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            {/* Call to Action */}
            <Box
                sx={{
                    pb: 30,
                    background:
                        'linear-gradient(180deg, transparent 0%, rgba(25, 118, 210, 0.05) 100%)',
                }}
            >
                <Box
                    ref={(el) => (sections.current[5] = el as HTMLDivElement)}
                    data-animation='fade-up'
                    sx={{
                        pt: 8,
                    }}
                >
                    <Container sx={{ textAlign: 'center' }}>
                        <AutoStoriesIcon
                            sx={{
                                width: 64,
                                height: 64,
                                mb: 3,
                                color: 'primary.main',
                                animation: 'spin 3s linear infinite',
                            }}
                        />
                        <Typography
                            variant='h3'
                            sx={{ fontSize: '2.25rem', fontWeight: 'bold', mb: 3 }}
                        >
                            Scrying has never been this easy.
                        </Typography>
                        <div
                            ref={(el) => (sections.current[6] = el as HTMLDivElement)}
                            data-animation='zoom-in'
                        >
                            <Button
                                href='/'
                                variant='contained'
                                color='success'
                                sx={{
                                    px: 4,
                                    py: 2,
                                    fontSize: '1.125rem',
                                    '&:hover .searchIcon': {
                                        transform: 'rotate(12deg)',
                                    },
                                }}
                            >
                                Begin
                                <SearchIcon
                                    className='searchIcon'
                                    sx={{ ml: 1, transition: 'transform 0.3s' }}
                                />
                            </Button>
                        </div>
                    </Container>
                </Box>
            </Box>
        </Box>
    );
};

export default About;
