import React from 'react'

type AuthAlertProps = {
  tone?: 'error' | 'success'
  children: React.ReactNode
}

const AuthAlert: React.FC<AuthAlertProps> = ({ tone = 'error', children }) => {
  const styles =
    tone === 'success'
      ? 'bg-green-50 border-green-200 text-green-800'
      : 'bg-red-50 border-red-200 text-red-700'

  return (
    <div className={`${styles} border px-4 py-3 rounded-lg`} role="alert">
      <p className="text-sm font-medium">{children}</p>
    </div>
  )
}

export default AuthAlert
