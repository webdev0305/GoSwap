import BigNumber from 'bignumber.js'
import React from 'react'
import { CardBody, Flex, Text, CardRibbon } from '@pancakeswap/uikit'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { CurrencyLogo } from 'components/Logo'
import { RowFixed } from 'components/Layout/Row'
import { useTranslation } from 'contexts/Localization'
import { getBalanceNumber } from 'utils/formatBalance'
import { BIG_ZERO } from 'utils/bigNumber'
import { DeserializedPool } from 'state/types'
import AprRow from './AprRow'
import { StyledCard } from './StyledCard'
// import CardFooter from './CardFooter'
import StyledCardHeader from './StyledCardHeader'
import CardActions from './CardActions'

const PoolCard: React.FC<{ pool: DeserializedPool; account: string }> = ({ pool, account }) => {
  const { sousId, stakingToken, earningToken, isFinished, userData } = pool
  const { t } = useTranslation()
  const stakedBalance = userData?.stakedBalance ? new BigNumber(userData.stakedBalance) : BIG_ZERO
  const accountHasStakedBalance = stakedBalance.gt(0)

  return (
    <StyledCard
      isFinished={isFinished && sousId !== 0}
      ribbon={isFinished && <CardRibbon variantColor="textDisabled" text={t('Finished')} />}
    >
      <StyledCardHeader
        isStaking={accountHasStakedBalance}
        earningToken={earningToken}
        stakingToken={stakingToken}
        isFinished={isFinished && sousId !== 0}
      />
      <CardBody p="24px 0 0 0">
        <AprRow pool={pool} stakedBalance={stakedBalance} />
        <Flex justifyContent="space-between" alignItems="flex-end" mt="30px">
          <Text>{t('Rewarded Token')}:</Text>
          <CurrencyLogo size="32px" />
        </Flex>
        {account && <Flex justifyContent="space-between" mt="20px">
          <Text>Staked Amount</Text>
          <RowFixed><Text>{getBalanceNumber(stakedBalance)}</Text></RowFixed>
        </Flex>}
        <Flex justifyContent="space-between" mt="20px">
          <Text>Deposit Fee</Text>
          <Text>{2}%</Text>
        </Flex>
        <Flex justifyContent="space-between" my="20px">
          <Text>Harvest Lookup</Text>
          <Text>{8}h</Text>
        </Flex>
        <Flex mt="24px" flexDirection="column">
          {account ? (
            <CardActions pool={pool} stakedBalance={stakedBalance} />
          ) : (
            <ConnectWalletButton />
          )}
        </Flex>
      </CardBody>
    </StyledCard>
  )
}

export default PoolCard
