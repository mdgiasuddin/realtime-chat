import {useAuth} from './context/AuthContext.jsx';
import AuthPage from './components/AuthPage.jsx';
import ChatPage from './components/ChatPage.jsx';

export default function App() {
    const {user} = useAuth();
    return user ? <ChatPage/> : <AuthPage/>;
}
