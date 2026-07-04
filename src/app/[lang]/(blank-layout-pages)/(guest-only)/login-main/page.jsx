// Component Imports
import Login from '@views/pages/auth/Login'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

const LoginPage = async () => {
  const mode = await getServerMode()

  return <Login mode={mode} />
}

export default LoginPage
