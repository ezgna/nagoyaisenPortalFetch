import React, { useState } from 'react';
import { Card, CardContent, Typography, Link, CircularProgress, Box, Grid, CardActionArea, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';

const DataDisplay = ({ data, setData, loading, setLoading, setLoggedIn }) => {
  const [open, setOpen] = useState(Array(data?.contents?.length || 0).fill(false));

  const toggleCard = (index) => {
    const newOpen = [...open];
    newOpen[index] = !newOpen[index];
    setOpen(newOpen);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const refreshResponse = await axios.post('/api/refresh');
      if (refreshResponse.data.message === 'Data refreshed successfully') {
        const dataResponse = await axios.get('/api/data');
        setData(dataResponse.data);
        console.log('refresh finished')
      }
    } catch (error) {
      const responseData = error.response.data;
      if (responseData && responseData.redirectTo) {
        console.log('Need to login');
        setLoggedIn(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2, width: '100% - 32px' }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '66%',
        maxWidth: '100%',
        margin: 'auto',
        mb: 2,
        '@media (max-width: 768px)': {
          width: 'calc(100% - 32px)',
        },
      }}>
        <Typography variant="h4" component="h2">
          通知一覧
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
        >
          更新
        </Button>
      </Box>
      {loading ? (
        <CircularProgress />
      ) : (
        <Box sx={{
          width: '66%',
          maxWidth: '100%',
          margin: 'auto',
          '@media (max-width: 768px)': {
            width: 'calc(100% - 32px)',
          },
        }}>
          {data?.contents?.map((content, index) => (
            <Card key={index} sx={{ mb: 2, width: '100%' }}>
              <CardActionArea onClick={() => toggleCard(index)}>
                <CardContent>
                  <Typography variant="h5" component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {content.title}
                    <ExpandMoreIcon
                      sx={{
                        transform: open[index] ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s',
                      }}
                    />
                  </Typography>
                  {open[index] && (
                    <>
                      <Grid container spacing={1} justifyContent="flex-start">
                        <Grid item xs={6} sx={{ pr: 1 }}>
                          <Typography sx={{ mb: 1.5 }} color="text.secondary">
                            {content.sender}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography sx={{ mb: 1.5 }} color="text.secondary">
                            {content.datetime}
                          </Typography>
                          </Grid>
                      </Grid>
                      <Typography variant="body2">
                        {content.message}
                      </Typography>
                      {content.attachment && (
                        <Link href={content.attachment.link} target="_blank" rel="noopener noreferrer" sx={{ mt: 2, display: 'block' }}>
                          {content.attachment.name}
                        </Link>
                      )}
                    </>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default DataDisplay;