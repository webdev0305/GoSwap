import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import styled from 'styled-components'
import BigNumber from 'bignumber.js'
import { ButtonMenu, useModal, ButtonMenuItem, CogIcon, Modal } from '@pancakeswap/uikit'
// import { Token } from '@pancakeswap/sdk'
import { useLocation } from 'react-router-dom'
// import Balance from 'components/Balance'
import { useTranslation } from 'contexts/Localization'
import { useAppDispatch } from 'state'
import { fetchFarmUserDataAsync } from 'state/farms'
import { useLpTokenPrice } from 'state/farms/hooks'
// import { getBalanceAmount /* , getBalanceNumber */ } from 'utils/formatBalance'
import DepositContent from '../DepositModal'
import WithdrawContent from '../WithdrawModal'
import useUnstakeFarms from '../../hooks/useUnstakeFarms'
import useStakeFarms from '../../hooks/useStakeFarms'

interface FarmCardActionsProps {
  stakedBalance?: BigNumber
  tokenBalance?: BigNumber
  tokenName?: string
  pid?: number
  multiplier?: string
  apr?: number
  displayApr?: string
  addLiquidityUrl?: string
  cakePrice?: BigNumber
  lpLabel?: string,
  farm?: any,
}

// const IconButtonWrapper = styled.div`
//   display: flex;
//   svg {
//     width: 20px;
//   }
// `

const StakeAction: React.FC<FarmCardActionsProps> = ({
  stakedBalance,
  tokenBalance,
  tokenName,
  pid,
  multiplier,
  apr,
  displayApr,
  addLiquidityUrl,
  cakePrice,
  lpLabel,
  farm,
}) => {
  const { t } = useTranslation()
  const { onStake } = useStakeFarms(pid)
  const { onUnstake } = useUnstakeFarms(pid)
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { account } = useWeb3React()
  const lpPrice = useLpTokenPrice(tokenName)

  const handleStake = async (amount: string) => {
    await onStake(amount)
    dispatch(fetchFarmUserDataAsync({ account, pids: [pid] }))
  }

  const handleUnstake = async (amount: string) => {
    await onUnstake(amount)
    dispatch(fetchFarmUserDataAsync({ account, pids: [pid] }))
  }

  // const displayBalance = useCallback(() => {
  //   const stakedBalanceBigNumber = getBalanceAmount(stakedBalance)
  //   if (stakedBalanceBigNumber.gt(0) && stakedBalanceBigNumber.lt(0.0000001)) {
  //     return '<0.0000001'
  //   }
  //   if (stakedBalanceBigNumber.gt(0)) {
  //     return stakedBalanceBigNumber.toFixed(8, BigNumber.ROUND_DOWN)
  //   }
  //   return stakedBalanceBigNumber.toFixed(3, BigNumber.ROUND_DOWN)
  // }, [stakedBalance])

  const StyledModal = styled(Modal)`
    padding: 10px;
    > :first-child {
      display: none;
    }
  `
  const StakeModel = () => {
    const [actionIndex, setActionIndex] = useState<number>(0)
    return <StyledModal title={t('Stake LP tokens1')}>
      <ButtonMenu activeIndex={actionIndex} scale="md" variant="subtle" onItemClick={(i)=>setActionIndex(i)}>
        <ButtonMenuItem>
          {t('Stake')}
        </ButtonMenuItem>
        <ButtonMenuItem>
          {t('Unstake')}
        </ButtonMenuItem>
      </ButtonMenu>
      {actionIndex===0?
        <DepositContent
          max={tokenBalance}
          stakedBalance={stakedBalance}
          onConfirm={handleStake}
          tokenName={tokenName}
          multiplier={multiplier}
          lpPrice={lpPrice}
          lpLabel={lpLabel}
          apr={apr}
          displayApr={displayApr}
          addLiquidityUrl={addLiquidityUrl}
          cakePrice={cakePrice}
          farm={farm}
        />:
        <WithdrawContent 
          max={stakedBalance} 
          stakedBalance={stakedBalance}
          cakePrice={cakePrice}
          onConfirm={handleUnstake} 
          tokenName={tokenName} 
          farm={farm}
        />
      }
    </StyledModal>
  }
  
  const [onPresentDeposit] = useModal(
    <StakeModel />
  )
  // const [onPresentWithdraw] = useModal(
  //   <WithdrawModal max={stakedBalance} onConfirm={handleUnstake} tokenName={tokenName} />,
  // )

  return <ButtonMenuItem
      style={{background:'#1EBF8D'}}
      onClick={onPresentDeposit}
      disabled={['history', 'archived'].some((item) => location.pathname.includes(item))}
    >
      {stakedBalance.eq(0)?t('Stake'):t('Manage')}
      {stakedBalance.gt(0) &&
        <CogIcon ml="8px" />
      }
    </ButtonMenuItem>
}

export default StakeAction
