import ModuleGate from '@/components/access/ModuleGate'
// Third-party Imports
import classnames from 'classnames'

// Component Imports
import ImageGeneratorBoard from '@views/apps/images/ImageGeneratorBoard'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'

// Styles Imports
import styles from '@views/apps/images/styles.module.css'

const KanbanPage = () => {
  return (
    <ModuleGate featureKey='module-images'>
      <div
        className={classnames(
          commonLayoutClasses.contentHeightFixed,
          styles.scroll,
          'is-full overflow-auto pis-2 -mis-2'
        )}
      >
        <ImageGeneratorBoard />
      </div>
    </ModuleGate>
  )
}

export default KanbanPage
