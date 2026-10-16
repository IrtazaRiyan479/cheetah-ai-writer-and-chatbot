import AmazonReviewFields from './AmazonReviewFields'
import { RewriteSourceField } from './RewriteFields'

const AmazonReviewRewriteFields = ({ settings, updateSetting }) => {
  return (
    <>
      <RewriteSourceField settings={settings} updateSetting={updateSetting} />
      <AmazonReviewFields settings={settings} updateSetting={updateSetting} />
    </>
  )
}

export default AmazonReviewRewriteFields
