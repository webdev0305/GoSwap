import React from 'react'
import styled from 'styled-components'
// import { Link } from 'react-router-dom'
import { Flex, Heading } from '@pancakeswap/uikit'
import { useWeb3React } from '@web3-react/core'
import { useTranslation } from 'contexts/Localization'
// import ConnectWalletButton from 'components/ConnectWalletButton'

const CoinsWrapper = styled.div`
  width: 100%;
`

const imagePath = '/images/'
const imageSrc = 'pools-logo'

const Hero = () => {
  const { t } = useTranslation()
  const { account } = useWeb3React()
  
  return (
    <>
      <Flex
        position="relative"
        flexDirection={['column-reverse', null, null, 'row']}
        alignItems={['flex-end', null, null, 'center']}
        justifyContent="center"
        mt={[account ? '280px' : '50px', null, 0]}
        id="homepage-hero"
      >
        <Flex flex="1" flexDirection="column">
          <Heading scale="xl" color="primary" mt="50px" mb="24px" style={{whiteSpace:'nowrap'}}>
            <span style={{ color: 'white' }}>{t('Stake ')}</span>
            {t('GO')}
            <span style={{ color: 'white' }}>{t(' tokens to earn, Earn ')}</span>
            {t('GO')}
          </Heading>
          <Heading scale="xl" color="primary" mb="24px">
            $105,786,890.44
          </Heading>
          <Heading color="#8B95A8" mb="24px">
            Total Value Locked (TVL)
          </Heading>
        </Flex>
        <Flex
          height={['192px', null, null, '100%']}
          width={['192px', null, null, '100%']}
          flex={[null, null, null, '1']}
          mb={['24px', null, null, '0']}
          position="relative"
        >
          <CoinsWrapper>
            <img src={`${imagePath}${imageSrc}.png`} alt={t('Coins')} />
          </CoinsWrapper>
        </Flex>
      </Flex>
    </>
  )
}

export default Hero
