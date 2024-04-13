import React, { useState } from 'react';
import LoginForm from './LoginForm';
import DataDisplay from './DataDisplay';

const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleLoginSuccess = () => {
    setLoggedIn(true);
  };

  return (
    <div className="App">
      {!loggedIn ? (
        <LoginForm onLoginSuccess={handleLoginSuccess} setData={setData} setLoading={setLoading} />
      ) : (
        <DataDisplay data={data} setData={setData} loading={loading} setLoading={setLoading} setLoggedIn={setLoggedIn} />
      )}
    </div>
  );
};

export default App;
