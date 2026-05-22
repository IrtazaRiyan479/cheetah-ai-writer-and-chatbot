// Third-party Imports
import classnames from 'classnames'

// Component Imports
import Pricing from '@components/pricing'

// Styles Imports
import frontCommonStyles from '@views/apps/styles.module.css'

const PricingSection = ({ data }) => {
  return (
    <section className='plb-[100px] pbs-[70px] rounded bg-backgroundPaper'>
      <div className={classnames('pbs-[50px] md:pbs-[100px]', frontCommonStyles.layoutSpacing)}>
        <Pricing data={data} />
      </div>
    </section>
  )
}

export default PricingSection
