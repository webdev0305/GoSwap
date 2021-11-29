import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BigNumber } from '@ethersproject/bignumber'
import { TransactionResponse } from '@ethersproject/providers'
import { Currency, currencyEquals, ETHER, Pair, TokenAmount, WETH } from '@pancakeswap/sdk'
import { Button, Text, Flex, AddIcon, CardBody, Message, Heading, WarningIcon } from '@pancakeswap/uikit'
import styled from 'styled-components'
import { Link, RouteComponentProps } from 'react-router-dom'
import { useIsTransactionUnsupported } from 'hooks/Trades'
import { useTranslation } from 'contexts/Localization'
import UnsupportedCurrencyFooter from 'components/UnsupportedCurrencyFooter'
import CurrencySearch from 'components/SearchModal/CurrencySearch'
import TransactionSettings from 'components/Menu/GlobalSettings/TransactionSettings'
import useActiveWeb3React from 'hooks/useActiveWeb3React'
// import useDebouncedChangeHandler from 'hooks/useDebouncedChangeHandler'
// import { useBurnActionHandlers } from 'state/burn/hooks'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../state'
// import { LightCard } from '../../components/Card'
import { AutoColumn, ColumnCenter } from '../../components/Layout/Column'
import TransactionConfirmationModal, { ConfirmationModalContent } from '../../components/TransactionConfirmationModal'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import { DoubleCurrencyLogo } from '../../components/Logo'
import { AppHeader, AppBody } from '../../components/App'
import { LiquidityDeposit, MinimalPositionCard, PoolInfoCard } from '../../components/PositionCard'
import { RowBetween } from '../../components/Layout/Row'
import ConnectWalletButton from '../../components/ConnectWalletButton'

import { ROUTER_ADDRESS } from '../../config/constants'
import { PairState, usePairs } from '../../hooks/usePairs'
import { useCurrency } from '../../hooks/Tokens'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import useTransactionDeadline from '../../hooks/useTransactionDeadline'
import { Field, resetMintState } from '../../state/mint/actions'
import { useDerivedMintInfo, useMintActionHandlers, useMintState } from '../../state/mint/hooks'

import { useTransactionAdder } from '../../state/transactions/hooks'
import { toV2LiquidityToken, useGasPrice, useIsExpertMode, useTrackedTokenPairs, useUserSlippageTolerance } from '../../state/user/hooks'
import { calculateGasMargin, calculateSlippageAmount, getRouterContract } from '../../utils'
import { maxAmountSpend } from '../../utils/maxAmountSpend'
import { unwrappedToken, wrappedCurrency } from '../../utils/wrappedCurrency'
import Dots from '../../components/Loader/Dots'
import ConfirmAddModalBottom from './ConfirmAddModalBottom'
import { currencyId } from '../../utils/currencyId'
import PoolPriceBar from './PoolPriceBar'
import Page from '../Page'
import { useTokenBalancesWithLoadingIndicator } from '../../state/wallet/hooks'
import RemoveLiquidityContent from './RemoveLiquidity'

export default function Liquidity({
  match: {
    params: { currencyIdA, currencyIdB },
  },
  location,
  history,
}: RouteComponentProps<{ currencyIdA?: string; currencyIdB?: string }>) {
  const { account, chainId, library } = useActiveWeb3React()
  const dispatch = useDispatch<AppDispatch>()
  const { t } = useTranslation()
  const gasPrice = useGasPrice()
  const showInfo = (location.pathname.startsWith('/liquidity') || location.pathname.startsWith('/remove')) && currencyIdA && currencyIdB

  const currencyA = useCurrency(currencyIdA)
  const currencyB = useCurrency(currencyIdB)

  useEffect(() => {
    if (!currencyIdA && !currencyIdB) {
      dispatch(resetMintState())
    }
  }, [dispatch, currencyIdA, currencyIdB])

  const oneCurrencyIsWETH = Boolean(
    chainId &&
      ((currencyA && currencyEquals(currencyA, WETH[chainId])) ||
        (currencyB && currencyEquals(currencyB, WETH[chainId]))),
  )

  const expertMode = useIsExpertMode()

  // mint state
  const { independentField, typedValue, otherTypedValue } = useMintState()
  const {
    dependentField,
    currencies,
    pair,
    pairState,
    currencyBalances,
    parsedAmounts,
    price,
    noLiquidity,
    liquidityMinted,
    poolTokenPercentage,
    error,
  } = useDerivedMintInfo(currencyA ?? undefined, currencyB ?? undefined)

  const { onFieldAInput, onFieldBInput } = useMintActionHandlers(noLiquidity)

  const isValid = !error

  // modal and loading
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm

  // txn values
  const deadline = useTransactionDeadline() // custom from users settings
  const [allowedSlippage] = useUserSlippageTolerance() // custom from users
  const [txHash, setTxHash] = useState<string>('')

  // get formatted amounts
  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: noLiquidity ? otherTypedValue : parsedAmounts[dependentField]?.toSignificant(6) ?? '',
    // [Field.LIQUIDITY_PERCENT]: removePercent===0 ? '0' : removePercent
  }

  // get the max amounts user can add
  const maxAmounts: { [field in Field]?: TokenAmount } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
    (accumulator, field) => {
      return {
        ...accumulator,
        [field]: maxAmountSpend(currencyBalances[field]),
      }
    },
    {},
  )

  const atMaxAmounts: { [field in Field]?: TokenAmount } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
    (accumulator, field) => {
      return {
        ...accumulator,
        [field]: maxAmounts[field]?.equalTo(parsedAmounts[field] ?? '0'),
      }
    },
    {},
  )

  // check whether the user has approved the router on the tokens
  const [approvalA, approveACallback] = useApproveCallback(parsedAmounts[Field.CURRENCY_A], ROUTER_ADDRESS)
  const [approvalB, approveBCallback] = useApproveCallback(parsedAmounts[Field.CURRENCY_B], ROUTER_ADDRESS)

  const addTransaction = useTransactionAdder()

  const onAdd = async() => {
    if (!chainId || !library || !account) return
    const router = getRouterContract(chainId, library, account)

    const { [Field.CURRENCY_A]: parsedAmountA, [Field.CURRENCY_B]: parsedAmountB } = parsedAmounts
    if (!parsedAmountA || !parsedAmountB || !currencyA || !currencyB || !deadline) {
      return
    }

    const amountsMin = {
      [Field.CURRENCY_A]: calculateSlippageAmount(parsedAmountA, noLiquidity ? 0 : allowedSlippage)[0],
      [Field.CURRENCY_B]: calculateSlippageAmount(parsedAmountB, noLiquidity ? 0 : allowedSlippage)[0],
    }

    let estimate
    let method: (...args: any) => Promise<TransactionResponse>
    let args: Array<string | string[] | number>
    let value: BigNumber | null
    if (currencyA === ETHER || currencyB === ETHER) {
      const tokenBIsETH = currencyB === ETHER
      estimate = router.estimateGas.addLiquidityETH
      method = router.addLiquidityETH
      args = [
        wrappedCurrency(tokenBIsETH ? currencyA : currencyB, chainId)?.address ?? '', // token
        (tokenBIsETH ? parsedAmountA : parsedAmountB).raw.toString(), // token desired
        amountsMin[tokenBIsETH ? Field.CURRENCY_A : Field.CURRENCY_B].toString(), // token min
        amountsMin[tokenBIsETH ? Field.CURRENCY_B : Field.CURRENCY_A].toString(), // eth min
        account,
        deadline.toHexString(),
      ]
      value = BigNumber.from((tokenBIsETH ? parsedAmountB : parsedAmountA).raw.toString())
    } else {
      estimate = router.estimateGas.addLiquidity
      method = router.addLiquidity
      args = [
        wrappedCurrency(currencyA, chainId)?.address ?? '',
        wrappedCurrency(currencyB, chainId)?.address ?? '',
        parsedAmountA.raw.toString(),
        parsedAmountB.raw.toString(),
        amountsMin[Field.CURRENCY_A].toString(),
        amountsMin[Field.CURRENCY_B].toString(),
        account,
        deadline.toHexString(),
      ]
      value = null
    }

    setAttemptingTxn(true)
    await estimate(...args, value ? { value } : {})
      .then((estimatedGasLimit) =>
        method(...args, {
          ...(value ? { value } : {}),
          gasLimit: calculateGasMargin(estimatedGasLimit),
          gasPrice,
        }).then((response) => {
          setAttemptingTxn(false)

          addTransaction(response, {
            summary: `Add ${parsedAmounts[Field.CURRENCY_A]?.toSignificant(3)} ${
              currencies[Field.CURRENCY_A]?.symbol
            } and ${parsedAmounts[Field.CURRENCY_B]?.toSignificant(3)} ${currencies[Field.CURRENCY_B]?.symbol}`,
          })

          setTxHash(response.hash)
        }),
      )
      .catch((err) => {
        setAttemptingTxn(false)
        // we only care if the error is something _other_ than the user rejected the tx
        if (err?.code !== 4001) {
          console.error(err)
        }
      })
  }

  const modalHeader = () => {
    return noLiquidity ? (
      <AutoColumn justify="center">
        <DoubleCurrencyLogo
          currency0={currencies[Field.CURRENCY_A]}
          currency1={currencies[Field.CURRENCY_B]}
          size={48}
        />
        <Text fontSize="24px" color="primary" mt="24px">
          {`${currencies[Field.CURRENCY_A]?.symbol}/${currencies[Field.CURRENCY_B]?.symbol} Pool Tokens`}
        </Text>
      </AutoColumn>
    ) : (
      <AutoColumn justify="center">
        <Text fontSize="40px" mb="24px">
          {liquidityMinted?.toSignificant(6)}
        </Text>
        <DoubleCurrencyLogo
          currency0={currencies[Field.CURRENCY_A]}
          currency1={currencies[Field.CURRENCY_B]}
          size={48}
        />
        <Text fontSize="24px" color="primary" mt="24px">
          {`${currencies[Field.CURRENCY_A]?.symbol}/${currencies[Field.CURRENCY_B]?.symbol} Pool Tokens`}
        </Text>
        <Text small my="24px" color="#8B95A8" textAlign="center">
          {t('Output is estimated. If the price changes by more than %slippage%% your transaction will revert.', {
            slippage: allowedSlippage / 100,
          })}
        </Text>
      </AutoColumn>
    )
  }

  const modalBottom = () => {
    return (
      <ConfirmAddModalBottom
        price={price}
        currencies={currencies}
        parsedAmounts={parsedAmounts}
        noLiquidity={noLiquidity}
        onAdd={onAdd}
        poolTokenPercentage={poolTokenPercentage}
      />
    )
  }

  const pendingText = t('Supplying %amountA% %symbolA% and %amountB% %symbolB%', {
    amountA: parsedAmounts[Field.CURRENCY_A]?.toSignificant(6) ?? '',
    symbolA: currencies[Field.CURRENCY_A]?.symbol ?? '',
    amountB: parsedAmounts[Field.CURRENCY_B]?.toSignificant(6) ?? '',
    symbolB: currencies[Field.CURRENCY_B]?.symbol ?? '',
  })

  const handleCurrencyASelect = useCallback(
    (currencyA_: Currency) => {
      const newCurrencyIdA = currencyId(currencyA_)
      if (newCurrencyIdA === currencyIdB) {
        history.push(`/add/${currencyIdB}/${currencyIdA}`)
      } else if (currencyIdB) {
        history.push(`/add/${newCurrencyIdA}/${currencyIdB}`)
      } else {
        history.push(`/add/${newCurrencyIdA}`)
      }
    },
    [currencyIdB, history, currencyIdA],
  )
  const handleCurrencyBSelect = useCallback(
    (currencyB_: Currency) => {
      const newCurrencyIdB = currencyId(currencyB_)
      if (currencyIdA === newCurrencyIdB) {
        if (currencyIdB) {
          history.push(`/add/${currencyIdB}/${newCurrencyIdB}`)
        } else {
          history.push(`/add/${newCurrencyIdB}`)
        }
      } else {
        history.push(`/add/${currencyIdA || 'BNB'}/${newCurrencyIdB}`)
      }
    },
    [currencyIdA, history, currencyIdB],
  )
  const handleRemoveCurrencyASelect = useCallback(
    (currency: Currency) => {
      if (currencyIdB && currencyId(currency) === currencyIdB) {
        history.push(`/remove/${currencyId(currency)}/${currencyIdA}`)
      } else {
        history.push(`/remove/${currencyId(currency)}/${currencyIdB}`)
      }
    },
    [currencyIdB, history, currencyIdA],
  )
  const handleRemoveCurrencyBSelect = useCallback(
    (currency: Currency) => {
      if (currencyIdA && currencyId(currency) === currencyIdA) {
        history.push(`/remove/${currencyIdB}/${currencyId(currency)}`)
      } else {
        history.push(`/remove/${currencyIdA}/${currencyId(currency)}`)
      }
    },
    [currencyIdA, history, currencyIdB],
  )

  // const handleDismissConfirmation = useCallback(() => {
  //   // if there was a tx hash, we want to clear the input
  //   if (txHash) {
  //     onFieldAInput('')
  //   }
  //   setTxHash('')
  // }, [onFieldAInput, txHash])

  const addIsUnsupported = useIsTransactionUnsupported(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

  // const [onPresentAddLiquidityModal] = useModal(
  //   <TransactionConfirmationModal
  //     attemptingTxn={attemptingTxn}
  //     hash={txHash}
  //     content={() => <ConfirmationModalContent topContent={modalHeader} bottomContent={modalBottom} />}
  //     pendingText={pendingText}
  //     currencyToAdd={pair?.liquidityToken}
  //   />,
  //   true,
  //   true,
  //   'addLiquidityModal',
  // )

  const trackedTokenPairs = useTrackedTokenPairs()
  const tokenPairsWithLiquidityTokens = useMemo(
    () => trackedTokenPairs.map((tokens) => ({ liquidityToken: toV2LiquidityToken(tokens), tokens })),
    [trackedTokenPairs],
  )
  const liquidityTokens = useMemo(
    () => tokenPairsWithLiquidityTokens.map((tpwlt) => tpwlt.liquidityToken),
    [tokenPairsWithLiquidityTokens],
  )
  const [v2PairsBalances, fetchingV2PairBalances] = useTokenBalancesWithLoadingIndicator(
    account ?? undefined,
    liquidityTokens,
  )

  // fetch the reserves for all V2 pools in which the user has a balance
  const liquidityTokensWithBalances = useMemo(
    () =>
      tokenPairsWithLiquidityTokens.filter(({ liquidityToken }) =>
        v2PairsBalances[liquidityToken.address]?.greaterThan('0'),
      ),
    [tokenPairsWithLiquidityTokens, v2PairsBalances],
  )

  const [viewStatus, setViewStatus] = React.useState(location.pathname.startsWith('/remove')?5:0)
  const v2Pairs = usePairs(liquidityTokensWithBalances.map(({ tokens }) => tokens))
  const v2IsLoading =
    fetchingV2PairBalances || v2Pairs?.length < liquidityTokensWithBalances.length || v2Pairs?.some((V2Pair) => !V2Pair)

  const allV2PairsWithLiquidity = v2Pairs.map(([, _pair]) => _pair).filter((v2Pair): v2Pair is Pair => Boolean(v2Pair))

  const PoolsTable = styled.table`
    thead {
      background: #273043;
      color: white;
      th {
        padding: 30px;
        text-align: left;
        &:first-child {
          border-radius: 20px 0 0 20px;
        }
        &:last-child {
          border-radius: 0 20px 20px 0;
        }
      }      
    }
    td {
      vertical-align: middle;
      padding: 1em;
      &:last-child button {
        width: 100%;
        color: white;
      }
    }
  `

  const Warning = styled.div`
    width: auto;
    margin: 50px auto;
    padding: 20px;
    background: #273043;
    border-radius: 20px;
    color: orange;
    font-size: 1.2em;
    display: flex;
    align-items: center;
  `

  const renderBody = () => {
    if (!account) {
      return (
        <tr>
          <td colSpan={3}>
            <Warning>
              <WarningIcon color="orange" width="48px" mr="20px" />
              {t('Connect to a wallet to view your liquidity.')}
            </Warning>    
          </td>
        </tr>
      )
    }
    if (v2IsLoading) {
      return (
        <tr>
          <td colSpan={3}>
            <Text color="textSubtle" textAlign="center" p="50px">
              <Dots>{t('Loading')}</Dots>
            </Text>
          </td>
        </tr>
      )
    }
    if (allV2PairsWithLiquidity?.length > 0) {
      const addressEllipsis = (address:string) => {
        return address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : null;
      }
      return allV2PairsWithLiquidity.map((v2Pair) => (        
        <tr key={`${v2Pair.token0.symbol}${v2Pair.token1.symbol}`}>
          <td>
            <Flex alignItems="center">
              <DoubleCurrencyLogo currency0={unwrappedToken(v2Pair.token0)} currency1={unwrappedToken(v2Pair.token1)} size={32} margin />
              <Text fontSize="20px" ml="20px">{addressEllipsis(v2Pair.liquidityToken.address)}</Text>
              <Button variant="text">
                <svg xmlns="http://www.w3.org/2000/svg" width="26.964" height="24" viewBox="0 0 26.964 24">
                  <path id="Icon_awesome-share-square" data-name="Icon awesome-share-square" d="M26.612,8.318l-6.741,6.374a1.124,1.124,0,0,1-1.895-.818V10.5c-6.768.045-9.623,1.646-7.713,8.032a.75.75,0,0,1-1.171.812,9.027,9.027,0,0,1-3.474-6.72c0-6.747,5.505-8.086,12.358-8.124V1.126A1.124,1.124,0,0,1,19.871.308l6.741,6.374A1.126,1.126,0,0,1,26.612,8.318Zm-8.636,9.454V21H3V6H5.379a.561.561,0,0,0,.4-.173A9.127,9.127,0,0,1,8.172,4.061.562.562,0,0,0,7.913,3H2.247A2.248,2.248,0,0,0,0,5.25v16.5A2.248,2.248,0,0,0,2.247,24H18.725a2.248,2.248,0,0,0,2.247-2.25V17.587a.562.562,0,0,0-.75-.53,3.358,3.358,0,0,1-1.6.158A.563.563,0,0,0,17.976,17.772Z" transform="translate(0 0)" fill="#fff"/>
                </svg>
              </Button>
            </Flex>
          </td>
          <td>
            <LiquidityDeposit pair={v2Pair} />
          </td>
          <td>
            <Button variant="secondary" as={Link} to={`/liquidity/${v2Pair.token0.address}/${v2Pair.token1.address}`}>Manage Your Liquidity</Button>
          </td>
        </tr>
      ))
    }
    return (
      <tr>
        <td colSpan={3} align="center">
          <img src="/images/pool-nodata.png" alt="No data" style={{margin:"40px 0"}} />
          <Text color="#70747B">
            Dont see a pool you joined? <Link style={{color:"#1EBF8D"}} to="/find">Import it</Link>
          </Text>
          <Text color="#70747B">
            Or, if you stake your tokens in a farm, unstake them to see
          </Text>
        </td>
      </tr>
    )
  }

  const Wrapper = styled.div`
    position: relative;
    padding: 24px;
    border-top: 1px solid #273043;
  `

  const [showRemoveConfirm,setShowRemoveConfirm] = useState<boolean>(false)

  return (
    <Page>
      <Flex justifyContent="space-between">
        <div style={{padding:'30px',background:'#1A202C',flex:1,display:'flex',flexDirection:'column'}}>
          <Heading color="white" mb="30px">My Liquidity</Heading>
          <PoolsTable>
            <thead>
              <tr>
                <th>Pool</th>
                <th>My Liquididy</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {renderBody()}
            </tbody>
          </PoolsTable>
          {/* {account && !v2IsLoading && (
            <Flex flexDirection="column" alignItems="center" mt="24px">
              <Text color="textSubtle" mb="8px">
                {t("Don't see a pool you joined?")}
              </Text>
              <Button id="import-pool-link" variant="secondary" scale="sm" as={Link} to="/find">
                {t('Find other LP tokens')}
              </Button>
            </Flex>
          )} */}
        </div>
        <div style={{display:(viewStatus===0?'flex':'none'),flexDirection: 'column',padding: '30px',background: '#1F2533',minWidth: '500px'}}>
          {showInfo?(
            <AppBody>
              <AppHeader
                title={t('Liquidity Details')}
                backTo="/liquidity"
                noConfig
              />
              <CardBody>
                {pair?<PoolInfoCard pair={pair} />:null}
                <Flex mt="2rem" justifyContent="space-between">
                  <Button variant="primary" as={Link} to={`/add/${currencyIdA}/${currencyIdB}`} style={{flex:1}}>Add</Button>
                  <Button variant="tertiary" onClick={()=>{setViewStatus(5)}} style={{flex:1,color:'white'}}>Remove</Button>
                </Flex>
              </CardBody>
            </AppBody>          
          ):(
            <AppBody>
              <AppHeader
                title={t('Liquidity')}
                subtitle={t('Stake Liquidity Pool (LP) tokens to earn')}
                cogHandler={()=>{setViewStatus(1)}}
              />
              <CardBody>
                <AutoColumn gap="20px">
                  {noLiquidity && (
                    <ColumnCenter>
                      <Message variant="warning">
                        <div>
                          <Text bold mb="8px">
                            {t('You are the first liquidity provider.')}
                          </Text>
                          <Text mb="8px">{t('The ratio of tokens you add will set the price of this pool.')}</Text>
                          <Text>{t('Once you are happy with the rate click supply to review.')}</Text>
                        </div>
                      </Message>
                    </ColumnCenter>
                  )}
                  <CurrencyInputPanel
                    value={formattedAmounts[Field.CURRENCY_A]}
                    onUserInput={onFieldAInput}
                    onMax={() => {
                      onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
                    }}
                    // onCurrencySelect={handleCurrencyASelect}
                    showMaxButton={!atMaxAmounts[Field.CURRENCY_A]}
                    currency={currencies[Field.CURRENCY_A]}
                    id="add-liquidity-input-tokena"
                    // showCommonBases
                    showCurrencySelect={()=>{setViewStatus(2)}}
                  />
                  <ColumnCenter>
                    <AddIcon width="32px" />
                  </ColumnCenter>
                  <CurrencyInputPanel
                    value={formattedAmounts[Field.CURRENCY_B]}
                    onUserInput={onFieldBInput}
                    // onCurrencySelect={handleCurrencyBSelect}
                    onMax={() => {
                      onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
                    }}
                    showMaxButton={!atMaxAmounts[Field.CURRENCY_B]}
                    currency={currencies[Field.CURRENCY_B]}
                    id="add-liquidity-input-tokenb"
                    // showCommonBases
                    showCurrencySelect={()=>{setViewStatus(3)}}
                  />
                  {currencies[Field.CURRENCY_A] && currencies[Field.CURRENCY_B] && pairState !== PairState.INVALID && (
                    <>
                      <RowBetween mt="1rem">
                        <Text fontSize="16px" color="#8B95A8">
                          {noLiquidity ? t('Initial prices and pool share') : t('Prices and pool share')}
                        </Text>
                      </RowBetween>{' '}
                      <PoolPriceBar
                        currencies={currencies}
                        poolTokenPercentage={poolTokenPercentage}
                        noLiquidity={noLiquidity}
                        price={price}
                      />
                    </>
                  )}

                  {addIsUnsupported ? (
                    <Button disabled mb="4px">
                      {t('Unsupported Asset')}
                    </Button>
                  ) : !account ? (
                    <ConnectWalletButton />
                  ) : (
                    <AutoColumn gap="md">
                      {(approvalA === ApprovalState.NOT_APPROVED ||
                        approvalA === ApprovalState.PENDING ||
                        approvalB === ApprovalState.NOT_APPROVED ||
                        approvalB === ApprovalState.PENDING) &&
                        isValid && (
                          <RowBetween>
                            {approvalA !== ApprovalState.APPROVED && (
                              <Button
                                onClick={approveACallback}
                                disabled={approvalA === ApprovalState.PENDING}
                                width={approvalB !== ApprovalState.APPROVED ? '48%' : '100%'}
                              >
                                {approvalA === ApprovalState.PENDING ? (
                                  <Dots>{t('Enabling %asset%', { asset: currencies[Field.CURRENCY_A]?.symbol })}</Dots>
                                ) : (
                                  t('Enable %asset%', { asset: currencies[Field.CURRENCY_A]?.symbol })
                                )}
                              </Button>
                            )}
                            {approvalB !== ApprovalState.APPROVED && (
                              <Button
                                onClick={approveBCallback}
                                disabled={approvalB === ApprovalState.PENDING}
                                width={approvalA !== ApprovalState.APPROVED ? '48%' : '100%'}
                              >
                                {approvalB === ApprovalState.PENDING ? (
                                  <Dots>{t('Enabling %asset%', { asset: currencies[Field.CURRENCY_B]?.symbol })}</Dots>
                                ) : (
                                  t('Enable %asset%', { asset: currencies[Field.CURRENCY_B]?.symbol })
                                )}
                              </Button>
                            )}
                          </RowBetween>
                        )}
                      <Button
                        variant={
                          !isValid && !!parsedAmounts[Field.CURRENCY_A] && !!parsedAmounts[Field.CURRENCY_B]
                            ? 'danger'
                            : 'primary'
                        }
                        onClick={() => {
                          if (expertMode) {
                            onAdd()
                          } else {
                            setViewStatus(4)
                          }
                        }}
                        disabled={!isValid || approvalA !== ApprovalState.APPROVED || approvalB !== ApprovalState.APPROVED}
                      >
                        {error ?? t('Supply')}
                      </Button>
                    </AutoColumn>
                  )}
                </AutoColumn>
              </CardBody>
            </AppBody>          
          )}
          {!showInfo && (!addIsUnsupported ? (
            pair && !noLiquidity && pairState !== PairState.INVALID ? (
              <AutoColumn style={{ minWidth: '20rem', maxWidth: '400px', margin: '0 2rem' }}>
                <MinimalPositionCard showUnwrapped={oneCurrencyIsWETH} pair={pair} />
              </AutoColumn>
            ) : null
          ) : (
            <UnsupportedCurrencyFooter currencies={[currencies.CURRENCY_A, currencies.CURRENCY_B]} />
          ))}
        </div>
        <div style={{display:(viewStatus===1?'flex':'none'),flexDirection: 'column',padding: '30px',background: '#1F2533',minWidth: '500px'}}>
          {viewStatus===1?
          <AppBody>
            <AppHeader title={t('Liquidity Settings')} backHandler={()=>{setViewStatus(0)}} noConfig/>
            <Wrapper>
              <TransactionSettings />
            </Wrapper>
          </AppBody>
          :null}
        </div>
        {viewStatus===2 || viewStatus===3 || viewStatus===6 || viewStatus===7?
          <div style={{display:'flex',flexDirection: 'column',padding: '30px',background: '#1F2533',minWidth: '500px'}}>
            <AppBody>
              <AppHeader title={t('Select a token')} backHandler={()=>{setViewStatus(0)}} noConfig/>
              <Wrapper>
                <CurrencySearch
                  onCurrencySelect={(cur:Currency)=>{
                    if(viewStatus===2)
                      handleCurrencyASelect(cur)
                    else if(viewStatus===3)
                      handleCurrencyBSelect(cur)
                    else if(viewStatus===6)
                      handleRemoveCurrencyASelect(cur)
                    else if(viewStatus===7)
                      handleRemoveCurrencyBSelect(cur)
                    if(viewStatus===2 || viewStatus===3)
                      setViewStatus(0)
                    if(viewStatus===6 || viewStatus===7)
                      setViewStatus(5)
                  }}
                  selectedCurrency={currencies[viewStatus===2?Field.CURRENCY_A:Field.CURRENCY_B]}
                  otherSelectedCurrency={currencies[viewStatus===3?Field.CURRENCY_A:Field.CURRENCY_B]}
                  // showCommonBases={showCommonBases}
                  showImportView={null}
                  setImportToken={null}
                />
              </Wrapper>
            </AppBody>
          </div>
        :null}
        <div style={{display:(viewStatus===4?'flex':'none'),flexDirection: 'column',padding: '30px',background: '#1F2533',minWidth: '500px'}}>
          {viewStatus===4?
          <AppBody>
            <AppHeader title={noLiquidity?t('Add New Liquidity'):t('You Will Receive')} noConfig backHandler={()=>{
              setViewStatus(0)
              if (txHash) {
                onFieldAInput('')
              }
              setTxHash('')
            }}/>
            <Wrapper>
              <TransactionConfirmationModal
                attemptingTxn={attemptingTxn}
                hash={txHash}
                content={() => <ConfirmationModalContent topContent={modalHeader} bottomContent={modalBottom} />}
                pendingText={pendingText}
                currencyToAdd={pair?.liquidityToken}
              />
            </Wrapper>
          </AppBody>
          :null}
        </div>
        <div style={{display:(viewStatus===5?'flex':'none'),flexDirection: 'column',padding: '30px',background: '#1F2533',minWidth: '500px'}}>
          {viewStatus===5?
          <AppBody>
            <AppHeader title={t(showRemoveConfirm?'You Will Receive':'Remove Liquidity')} noConfig backHandler={()=>{
              if(showRemoveConfirm)
                setShowRemoveConfirm(false)
              else
                setViewStatus(0)
            }}/>
            <Wrapper>
              <RemoveLiquidityContent currencyIdA={currencyIdA} currencyIdB={currencyIdB} setViewStatus={setViewStatus} showConfirm={showRemoveConfirm} setShowConfirm={setShowRemoveConfirm}/>
            </Wrapper>
          </AppBody>
          :null}
        </div>
      </Flex>
    </Page>
  )
}