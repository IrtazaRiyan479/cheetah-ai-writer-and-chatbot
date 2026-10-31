import ModuleGate from '@/components/access/ModuleGate'
import ChatWrapper from '@views/apps/chat'
import { FeatureAccessProvider } from '@views/apps/writer/FeatureAccessContext'

const ChatApp = () => {
  return (
    <ModuleGate featureKey='module-chat'>
      <FeatureAccessProvider>
        <ChatWrapper />
      </FeatureAccessProvider>
    </ModuleGate>
  )
}

export default ChatApp
