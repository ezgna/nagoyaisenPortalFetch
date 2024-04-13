import React, { useState } from 'react';
import axios from 'axios';
import { Button, TextField, Box, Typography, CircularProgress } from '@mui/material';

const LoginForm = ({ onLoginSuccess, setData, setLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/data');
      setData(response.data);
    } catch (error) {
      console.error('There was an error fetching the data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post('/api/login', { username, password });
      onLoginSuccess();
      fetchData();
    } catch (error) {
      setErrorMessage('ユーザー名かパスワードが間違っています');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '-10vh',
      }}
    >
      <Box
        sx={{
          width: 400,
          mx: 'auto',
          my: 5,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(255, 255, 255, 0.8)', // フォームの背景色を少し透明にしてグラデーションを見せる
          borderRadius: '5px', // フォームの角を丸くする
          boxShadow: '0 3px 5px 2px rgba(0, 0, 0, .3)', // 影を追加して立体感を出す
          padding: '20px',
        }}
      >
        <Typography variant="h5" component="h2" mb={1} textAlign="center">
          名古屋医専ポータルフェッチ
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <TextField
            label="ユーザー名"
            variant="outlined"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="パスワード"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errorMessage && (
            <Typography color="error" mb={2} textAlign="center">
              {errorMessage}
            </Typography>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'ログイン'}
          </Button>
        </form>
      </Box>
    </Box>
  );
};

export default LoginForm;