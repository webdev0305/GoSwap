import React from 'react'
import { useWeb3React } from '@web3-react/core'
import {
  Button,
  CopyIcon,
  Flex,
  Heading,
  LogoutIcon,
  Text,
  useMatchBreakpoints,
  // useModal,
  UserMenu as UIKitUserMenu,
  // UserMenuDivider,
  // UserMenuItem,
  WarningIcon,
} from '@pancakeswap/uikit'
// import history from 'routerHistory'
import useAuth from 'hooks/useAuth'
import { formatBigNumber, getFullDisplayBalance } from 'utils/formatBalance'
// import { useProfile } from 'state/profile/hooks'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { FetchStatus, useGetBnbBalance } from 'hooks/useTokenBalance'
import { useTranslation } from 'contexts/Localization'
// import { nftsBaseUrl } from 'views/Nft/market/constants'
import { usePriceCakeBusd } from 'state/farms/hooks'
// import styled from 'styled-components'
import { LOW_BNB_BALANCE } from './WalletModal'
// import ProfileUserMenuItem from './ProfileUserMenutItem'
// import WalletUserMenuItem from './WalletUserMenuItem'

const UserMenu = () => {
  const { t } = useTranslation()
  const { account } = useWeb3React()
  const { logout } = useAuth()
  const { balance, fetchStatus } = useGetBnbBalance()
  const cakePriceUsd = usePriceCakeBusd()
  const hasLowBnbBalance = fetchStatus === FetchStatus.SUCCESS && balance.lte(LOW_BNB_BALANCE)
  const { isMobile } = useMatchBreakpoints()

  if (!account) {
    if (isMobile)
      return <ConnectWalletButton scale={isMobile ? "sm" : "md"} style={{ borderRadius: '25px' }} />
    return <Flex alignItems="center" background="#273043" borderRadius="25px">
      <span style={{ display: 'inline-block', width: '0.4em', height: '0.4em', background: '#1EBF8D', borderRadius: '50%', marginLeft: '1em' }} />
      <Text color="white" pr="1em" pl="0.6em">BSC</Text>
      <ConnectWalletButton scale="md" style={{ borderRadius: '25px' }} />
    </Flex>
  }

  const copyAddress = () => {
    const el = document.createElement("textarea");
    el.value = account;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }

  return (
    <UIKitUserMenu account={account}>
      <Heading as="div" scale="lg">
        Account
      </Heading>
      <Flex justifyContent="space-between" mt="8px">
        <Heading textTransform="uppercase">{account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : null}</Heading>
        <Button padding="0" height="auto" variant="tertiary" onClick={copyAddress}><CopyIcon /></Button>
      </Flex>
      <Flex justifyContent="space-between" my="8px">
        <Heading style={{ flex: 1 }}>Total Balance</Heading>
        {hasLowBnbBalance ? <WarningIcon color="warning" width="24px" /> : <>
          <Text color="white">${getFullDisplayBalance(cakePriceUsd.multipliedBy(formatBigNumber(balance)), 0, 2)}</Text>
          <Text color="primary" pl="5px">{formatBigNumber(balance)} GO</Text>
        </>}
      </Flex>
      <Button variant="primary" onClick={logout} width="100%">
        <Flex alignItems="center">
          <LogoutIcon />
          {t('Disconnect')}
        </Flex>
      </Button>
    </UIKitUserMenu>
  )
}

export default UserMenu
