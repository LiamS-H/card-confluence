import {
    Box,
    Typography,
    Grid,
    Paper,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Container,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import FolderIcon from '@mui/icons-material/Folder';
import FormatShapesIcon from '@mui/icons-material/FormatShapes';

export default function About() {
    return (
        <Container>
            <Typography variant='h4' gutterBottom>
                Card Confluence
            </Typography>
            <Typography variant='subtitle1' gutterBottom>
                Simplify complex search queries and make powerful combinations easily!
            </Typography>

            <Grid container spacing={3}>
                {/* Feature 1: Auto-complete for search tags */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ padding: 3 }}>
                        <List>
                            <ListItem>
                                <ListItemIcon>
                                    <SearchIcon color='primary' />
                                </ListItemIcon>
                                <ListItemText
                                    primary='Auto-complete for Search Tags'
                                    secondary='Easily find and apply search terms with auto-completion to streamline your query-building.'
                                />
                            </ListItem>
                        </List>
                    </Paper>
                </Grid>

                {/* Feature 2: Syntax Error Highlighting */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ padding: 3 }}>
                        <List>
                            <ListItem>
                                <ListItemIcon>
                                    <CodeIcon color='primary' />
                                </ListItemIcon>
                                <ListItemText
                                    primary='Error Highlighting'
                                    secondary='Automatically parse scryfall errors and highlight incorrect filters.'
                                />
                            </ListItem>
                        </List>
                    </Paper>
                </Grid>

                {/* Feature 3: Complex Query Organization */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ padding: 3 }}>
                        <List>
                            <ListItem>
                                <ListItemIcon>
                                    <FolderIcon color='primary' />
                                </ListItemIcon>
                                <ListItemText
                                    primary='Complex Query Organization'
                                    secondary='Build nested queries and organize complex filters visually to reduce clutter.'
                                />
                            </ListItem>
                        </List>
                    </Paper>
                </Grid>

                {/* Feature 4: Custom Query Blocks */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ padding: 3 }}>
                        <List>
                            <ListItem>
                                <ListItemIcon>
                                    <FormatShapesIcon color='primary' />
                                </ListItemIcon>
                                <ListItemText
                                    primary='Custom Query Blocks'
                                    secondary='Group filters into custom blocks, rename them, and reuse with ease.'
                                />
                            </ListItem>
                        </List>
                    </Paper>
                </Grid>
            </Grid>

            {/* Description section */}
            <Box sx={{ mt: 5 }}>
                <Typography variant='body1'>
                    If you're like me, you use the scryfall advanced syntax a lot.
                </Typography>
                <Typography variant='body1'>
                    But creating complex queries is quite annoying on the scryfall searchbar.
                </Typography>
                <Typography variant='body1'>
                    I made this tool to manage my more complex queries, and it's something I
                    genuinely hope to continue improving.
                </Typography>
            </Box>
        </Container>
    );
}
