import AmazonRoundupFields from './AmazonRoundupFields'
import { RewriteSourceField } from './RewriteFields'

const AmazonRoundupRewriteFields = ({ settings, updateSetting }) => {
  return (
    <>
      <RewriteSourceField settings={settings} updateSetting={updateSetting} />
      <AmazonRoundupFields settings={settings} updateSetting={updateSetting} />
    </>
  )
}

export default AmazonRoundupRewriteFields
