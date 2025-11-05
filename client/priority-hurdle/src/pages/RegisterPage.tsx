// client/src/pages/RegisterPage.tsx (Updated for Email and Username)

import React, { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { REGISTER_MUTATION } from '../graphql/mutations';
import { useNavigate, Link } from 'react-router-dom';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState(''); // Keep username for display/invites
  const [email, setEmail] = useState(''); // NEW: Email for unique login
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const [register, { loading, error }] = useMutation(REGISTER_MUTATION, {
    onCompleted: (data) => {
      localStorage.setItem('token', data.register.token);
      navigate('/home'); 
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mutation now passes all three fields in the input object
    register({ variables: { input: { username, email, password } } }); 
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-center text-gray-900">Register Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username (Display Name)</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., awesome_coder"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address (Login ID)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="unique@work.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error.message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <div className="text-sm text-center">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Log in here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;