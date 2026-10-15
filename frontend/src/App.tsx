import {useAuth} from './hooks/useAuth';
import AuthPage from './components/auth/AuthPage';
import KeyGate from './components/auth/KeyGate';
import ChatPage from './components/chat/ChatPage';

export default function App() {
    const {user} = useAuth();
    return user
        ? (
            <KeyGate key={user.username} user={user}>
                {(identity) => <ChatPage user={user} identity={identity}/>}
            </KeyGate>
        )
        : <AuthPage/>;
}
