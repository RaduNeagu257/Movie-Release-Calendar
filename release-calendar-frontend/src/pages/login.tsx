import { useState } from 'react'
import { useRouter } from 'next/router'

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const API = `${process.env.NEXT_PUBLIC_BASE_URL}:${process.env.NEXT_PUBLIC_BACKEND_PORT}`;

    const response = await fetch(`${API}/login`, { // Use the base API URL for the login route

      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await response.json()

    if (response.ok) {
      // Store the JWT token in localStorage or cookies
      localStorage.setItem('token', data.token)  // Store JWT token in localStorage
      localStorage.setItem('email', email)  // Store email in localStorage for later use
      router.push('/')  // Redirect to calendar after successful login
    } else {
      setError(data.error)  // Display error message
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl mb-4 text-white">Login</h2>
      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-white">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border border-gray-700 bg-gray-800 text-white rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block text-white">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border border-gray-700 bg-gray-800 text-white rounded"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-purple-primary text-white px-4 py-2 rounded mt-4">
          Log In
        </button>
      </form>
      <p className="text-white mt-4">
        Don't have an account?{' '}
        <button
          onClick={() => router.push('/signup')}
          className="bg-purple-primary text-white px-4 py-2 rounded mt-4"
        >
          Sign Up
        </button>
      </p>
    </div>
  )
}

export default LoginPage
