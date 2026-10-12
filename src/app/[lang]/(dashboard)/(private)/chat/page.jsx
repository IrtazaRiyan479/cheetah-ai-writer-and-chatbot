import ModuleGate from '@/components/access/ModuleGate'
import ChatWrapper from '@views/apps/chat'

const ChatApp = () => {
  return (
    <ModuleGate featureKey='module-chat'>
      <ChatWrapper />
    </ModuleGate>
  )
}

export default ChatApp
