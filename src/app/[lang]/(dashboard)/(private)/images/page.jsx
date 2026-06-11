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
    <div
      className={classnames(
        commonLayoutClasses.contentHeightFixed,
        styles.scroll,
        'is-full overflow-auto pis-2 -mis-2'
      )}
    >
      <ImageGeneratorBoard />
    </div>
  )
}

export default KanbanPage
