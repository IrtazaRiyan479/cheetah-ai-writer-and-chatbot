import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'

import PlanDetails from './PlanDetails'

const Pricing = ({ data }) => {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col justify-center items-center gap-2'>
        <Typography variant='h4'>Word packs</Typography>
        <div className='flex items-center text-center flex-col sm:mbe-4'>
          <Typography>Buy words once. They stay on the account, and you can buy again at any time.</Typography>
        </div>
      </div>
      <Grid container spacing={6}>
        {data?.map((plan, index) => (
          <Grid size={{ xs: 12, md: 4 }} key={index}>
            <PlanDetails data={plan} />
          </Grid>
        ))}
      </Grid>
    </div>
  )
}

export default Pricing
