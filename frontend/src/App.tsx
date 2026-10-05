import {useAuth} from './hooks/useAuth';
import AuthPage from './components/auth/AuthPage';
import ChatPage from './components/chat/ChatPage';

export default function App() {
    const {user} = useAuth();
    return user ? <ChatPage user={user}/> : <AuthPage/>;
}
