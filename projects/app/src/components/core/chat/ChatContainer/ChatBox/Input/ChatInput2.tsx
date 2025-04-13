import { useSpeech } from '@/web/common/hooks/useSpeech';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { Box, Flex, Spinner, Textarea } from '@chakra-ui/react';
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'next-i18next';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import { ChatBoxInputFormType, ChatBoxInputType, SendPromptFnType } from '../type';
import { textareaMinH } from '../constants';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { ChatBoxContext } from '../Provider';
import dynamic from 'next/dynamic';
import { useContextSelector } from 'use-context-selector';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import { documentFileType } from '@fastgpt/global/common/file/constants';
import FilePreview from '../../components/FilePreview';
import { useFileUpload } from '../hooks/useFileUpload';
import ComplianceTip from '@/components/common/ComplianceTip/index';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useState } from 'react';

import { useContext } from 'react';
import { MessageContext } from '@/pages/chat/share';

import { MessageProvider, useMessageContext } from '@/pages/chat/MessageContext';
const InputGuideBox = dynamic(() => import('./InputGuideBox'));

const fileTypeFilter = (file: File) => {
  return (
    file.type.includes('image') ||
    documentFileType.split(',').some((type) => file.name.endsWith(type.trim()))
  );
};

const ChatInput = ({
  onSendMessage,
  onStop,
  TextareaDom,
  resetInputVal,
  chatForm
}: {
  onSendMessage: SendPromptFnType;
  onStop: () => void;
  TextareaDom: React.MutableRefObject<HTMLTextAreaElement | null>;
  resetInputVal: (val: ChatBoxInputType) => void;
  chatForm: UseFormReturn<ChatBoxInputFormType>;
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isPc } = useSystem();

  const { setValue, watch, control } = chatForm;
  const inputValue = watch('input');

  const outLinkAuthData = useContextSelector(ChatBoxContext, (v) => v.outLinkAuthData);
  const appId = useContextSelector(ChatBoxContext, (v) => v.appId);
  const chatId = useContextSelector(ChatBoxContext, (v) => v.chatId);
  const isChatting = useContextSelector(ChatBoxContext, (v) => v.isChatting);
  const whisperConfig = useContextSelector(ChatBoxContext, (v) => v.whisperConfig);
  const autoTTSResponse = useContextSelector(ChatBoxContext, (v) => v.autoTTSResponse);
  const chatInputGuide = useContextSelector(ChatBoxContext, (v) => v.chatInputGuide);
  const fileSelectConfig = useContextSelector(ChatBoxContext, (v) => v.fileSelectConfig);

  const fileCtrl = useFieldArray({
    control,
    name: 'files'
  });
  const {
    File,
    onOpenSelectFile,
    fileList,
    onSelectFile,
    uploadFiles,
    selectFileIcon,
    selectFileLabel,
    showSelectFile,
    showSelectImg,
    removeFiles,
    replaceFiles,
    hasFileUploading
  } = useFileUpload({
    fileSelectConfig,
    fileCtrl,
    outLinkAuthData,
    appId,
    chatId
  });
  const havInput = !!inputValue || fileList.length > 0;
  const canSendMessage = havInput && !hasFileUploading;
  const [isActive, setIsActive] = useState(false);

  const [customVar1, setCustomVar1] = useState(1);
  // 处理点击事件，切换值
  const handleToggleVariable = () => {
    setCustomVar1((prev) => (prev === 1 ? 2 : 1));
  };
  // Upload files
  useRequest2(uploadFiles, {
    manual: false,
    errorToast: t('common:upload_file_error'),
    refreshDeps: [fileList, outLinkAuthData, chatId]
  });

  /* on send */
  const handleSend = useCallback(
    async (val?: string) => {
      if (!canSendMessage) return;
      const textareaValue = val || TextareaDom.current?.value || '';

      onSendMessage({
        text: textareaValue.trim(),
        files: fileList
      });
      replaceFiles([]);
    },
    [TextareaDom, canSendMessage, fileList, onSendMessage, replaceFiles]
  );

  /* whisper init */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    isSpeaking,
    isTransCription,
    stopSpeak,
    startSpeak,
    speakingTimeString,
    renderAudioGraph,
    stream
  } = useSpeech({ appId, ...outLinkAuthData });
  const onWhisperRecord = useCallback(() => {
    const finishWhisperTranscription = (text: string) => {
      if (!text) return;
      if (whisperConfig?.autoSend) {
        onSendMessage({
          text,
          files: fileList,
          autoTTSResponse
        });
        replaceFiles([]);
      } else {
        resetInputVal({ text });
      }
    };
    if (isSpeaking) {
      return stopSpeak();
    }
    startSpeak(finishWhisperTranscription);
  }, [
    autoTTSResponse,
    fileList,
    isSpeaking,
    onSendMessage,
    replaceFiles,
    resetInputVal,
    startSpeak,
    stopSpeak,
    whisperConfig?.autoSend
  ]);
  useEffect(() => {
    if (!stream) {
      return;
    }
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 1;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const renderCurve = () => {
      if (!canvasRef.current) return;
      renderAudioGraph(analyser, canvasRef.current);
      window.requestAnimationFrame(renderCurve);
    };

    renderCurve();
  }, [renderAudioGraph, stream]);

  const RenderTranslateLoading = useMemo(
    () => (
      <Flex
        position={'absolute'}
        top={0}
        bottom={0}
        left={0}
        right={0}
        zIndex={10}
        pl={5}
        alignItems={'center'}
        bg={'white'}
        color={'primary.500'}
        visibility={isSpeaking && isTransCription ? 'visible' : 'hidden'}
      >
        <Spinner size={'sm'} mr={4} />
        {t('common:core.chat.Converting to text')}
      </Flex>
    ),
    [isSpeaking, isTransCription, t]
  );

  const RenderTextarea = useMemo(
    () => (
      <Flex alignItems={'flex-end'} mt={fileList.length > 0 ? 1 : 0} pl={[2, 4]}>
        <Flex
          direction={'column'}
          gap={0}
          width={'100%'}
          alignItems={'left'}
          justifyContent={'left'}
        >
          {/* input area */}
          <Textarea
            ref={TextareaDom}
            py={0}
            pl={2}
            mb={10}
            // ml={-6}
            bg={'#F9F9F9'}
            _focusVisible={{
              border: 'none'
            }}
            _focus={{
              bg: '#F9F9F9', // 聚焦时背景色
              border: 'none', // 移除默认聚焦边框
              boxShadow: 'none' // 移除聚焦阴影
            }}
            _hover={{
              bg: '#F9F9F9' // 鼠标悬停时背景色
            }}
            _disabled={{
              bg: '#F9F9F9', // 禁用时背景色
              opacity: 1 // 防止禁用时变灰
            }}
            pr={['30px', '48px']}
            border={'none'}
            placeholder={
              isSpeaking
                ? t('common:core.chat.Speaking')
                : isPc
                  ? t('common:core.chat.Type a message')
                  : t('chat:input_placeholder_phone')
            }
            resize={'none'}
            rows={1}
            height={'22px'}
            lineHeight={'22px'}
            maxHeight={'40vh'}
            maxLength={-1}
            overflowY={'auto'}
            whiteSpace={'pre-wrap'}
            wordBreak={'break-all'}
            boxShadow={'none !important'}
            color={'myGray.900'}
            isDisabled={isSpeaking}
            value={inputValue}
            fontSize={['md', 'sm']}
            onChange={(e) => {
              const textarea = e.target;
              textarea.style.height = textareaMinH;
              textarea.style.height = `${textarea.scrollHeight}px`;
              setValue('input', textarea.value);
            }}
            onKeyDown={(e) => {
              // enter send.(pc or iframe && enter and unPress shift)
              const isEnter = e.keyCode === 13;
              if (isEnter && TextareaDom.current && (e.ctrlKey || e.altKey)) {
                // Add a new line
                const index = TextareaDom.current.selectionStart;
                const val = TextareaDom.current.value;
                TextareaDom.current.value = `${val.slice(0, index)}\n${val.slice(index)}`;
                TextareaDom.current.selectionStart = index + 1;
                TextareaDom.current.selectionEnd = index + 1;

                TextareaDom.current.style.height = textareaMinH;
                TextareaDom.current.style.height = `${TextareaDom.current.scrollHeight}px`;

                return;
              }

              // 全选内容
              // @ts-ignore
              e.key === 'a' && e.ctrlKey && e.target?.select();

              if ((isPc || window !== parent) && e.keyCode === 13 && !e.shiftKey) {
                handleSend();
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              const clipboardData = e.clipboardData;
              if (clipboardData && (showSelectFile || showSelectImg)) {
                const items = clipboardData.items;
                const files = Array.from(items)
                  .map((item) => (item.kind === 'file' ? item.getAsFile() : undefined))
                  .filter((file) => {
                    return file && fileTypeFilter(file);
                  }) as File[];
                onSelectFile({ files });

                if (files.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            }}
          />

          <Flex
            direction={'row'}
            gap={3}
            width={'100%'}
            alignItems={'center'}
            justifyContent={'left'}
          >
            {/* file selector */}
            {(showSelectFile || showSelectImg) && (
              <Flex
                h={'25px'}
                cursor={'pointer'}
                onClick={() => {
                  if (isSpeaking) return;
                  onOpenSelectFile();
                }}
                transform={'translateY(2px)'}
              >
                <MyTooltip label={selectFileLabel}>
                  <MyIcon name={'common/add3'} w={'20px'} color={'myGray.600'} />
                </MyTooltip>
                <File onSelect={(files) => onSelectFile({ files })} />
              </Flex>
            )}

            {/* Add search button */}
            <MyTooltip label="深度思考">
              <Flex
                p={'5px'}
                h={'30px'}
                fontSize="14px"
                direction={'row'}
                alignItems={'center'}
                cursor={'pointer'}
                justifyContent={'center'}
                onClick={() => {
                  setIsActive(!isActive);
                  handleToggleVariable();

                  let currentValue = document.cookie.replace(
                    /(?:(?:^|.*;\s*)userPreference\s*\=\s*([^;]*).*$)|^.*$/,
                    '$1'
                  );
                  let newValue = currentValue === '1' ? '2' : '1'; // 如果当前值是 1，设置为 2，否则设置为 1

                  // 设置新的 cookie 值
                  document.cookie = `userPreference=${newValue}; path=/; max-age=3600`;
                  console.log(`Cookie value set to ${newValue}`);

                  send();
                }}
                sx={{
                  overflow: 'hidden',
                  border: '0.5px solid #ccc', // 使用0.5px实现超细边框
                  // 默认样式
                  ...(!isActive && {
                    color: 'myGray.600',
                    bg: 'transparent'
                  }),
                  // 激活样式（保持和hover一致）
                  ...(isActive && {
                    bg: 'rgba(0, 0, 0, 0.13)',
                    color: 'black',
                    borderWidth: '0.5px'
                  })
                }}
                style={{ borderRadius: '8px' }} // 为父容器添加边框
              >
                <MyIcon name={'common/deep'} w={'18px'} mr={'3px'} color={'myGray.600'} />
                <span>深度思考</span>
              </Flex>
            </MyTooltip>
          </Flex>
        </Flex>

        <Flex alignItems={'center'} position={'absolute'} right={[2, 4]} bottom={['10px', '12px']}>
          {/* voice-input */}
          {whisperConfig?.open && !inputValue && !isChatting && (
            <>
              <canvas
                ref={canvasRef}
                style={{
                  height: '30px',
                  width: isSpeaking && !isTransCription ? '100px' : 0,
                  background: 'white',
                  zIndex: 0
                }}
              />
              {isSpeaking && (
                <MyTooltip label={t('common:core.chat.Cancel Speak')}>
                  <Flex
                    mr={2}
                    alignItems={'center'}
                    justifyContent={'center'}
                    flexShrink={0}
                    h={['26px', '32px']}
                    w={['26px', '32px']}
                    borderRadius={'md'}
                    cursor={'pointer'}
                    _hover={{ bg: '#F5F5F8' }}
                    onClick={() => stopSpeak(true)}
                  >
                    <MyIcon
                      name={'core/chat/cancelSpeak'}
                      width={['20px', '22px']}
                      height={['20px', '22px']}
                    />
                  </Flex>
                </MyTooltip>
              )}
              <MyTooltip
                label={
                  isSpeaking ? t('common:core.chat.Finish Speak') : t('common:core.chat.Record')
                }
              >
                <Flex
                  mr={2}
                  alignItems={'center'}
                  justifyContent={'center'}
                  flexShrink={0}
                  h={['26px', '32px']}
                  w={['26px', '32px']}
                  borderRadius={'md'}
                  cursor={'pointer'}
                  _hover={{ bg: '#F5F5F8' }}
                  onClick={onWhisperRecord}
                >
                  <MyIcon
                    name={isSpeaking ? 'core/chat/finishSpeak' : 'core/chat/recordFill'}
                    width={['20px', '22px']}
                    height={['20px', '22px']}
                    color={isSpeaking ? 'primary.500' : 'myGray.600'}
                  />
                </Flex>
              </MyTooltip>
            </>
          )}
          {/* send and stop icon */}
          {isSpeaking ? (
            <Box color={'#5A646E'} w={'36px'} textAlign={'right'} whiteSpace={'nowrap'}>
              {speakingTimeString}
            </Box>
          ) : (
            <Flex
              alignItems={'center'}
              justifyContent={'center'}
              flexShrink={0}
              h={['28px', '32px']}
              w={['28px', '32px']}
              borderRadius={'50%'}
              bg={isSpeaking || isChatting ? '' : !havInput || hasFileUploading ? '#000' : '#000'}
              cursor={havInput ? 'pointer' : 'not-allowed'}
              lineHeight={1}
              onClick={() => {
                if (isChatting) {
                  return onStop();
                }
                return handleSend();
              }}
            >
              {isChatting ? (
                <MyIcon
                  animation={'zoomStopIcon 0.4s infinite alternate'}
                  width={['22px', '25px']}
                  height={['22px', '25px']}
                  cursor={'pointer'}
                  name={'stop'}
                  color={'gray.500'}
                />
              ) : (
                <MyTooltip label={t('common:core.chat.Send Message')}>
                  <MyIcon
                    name={'core/chat/sendFill'}
                    width={['18px', '20px']}
                    height={['18px', '20px']}
                    color={'white'}
                  />
                </MyTooltip>
              )}
            </Flex>
          )}
        </Flex>
      </Flex>
    ),
    [
      File,
      TextareaDom,
      fileList,
      handleSend,
      hasFileUploading,
      havInput,
      inputValue,
      isChatting,
      isPc,
      isSpeaking,
      isTransCription,
      onOpenSelectFile,
      onSelectFile,
      onStop,
      onWhisperRecord,
      selectFileIcon,
      selectFileLabel,
      setValue,
      showSelectFile,
      showSelectImg,
      speakingTimeString,
      stopSpeak,
      t,
      whisperConfig?.open
    ]
  );

  const { message, setMessage } = useMessageContext();

  console.log(message, setMessage);

  const [flag, setFlag] = useState(1);
  const send = () => {
    if (flag == 1) {
      setMessage('深度思考');
      setFlag(2);
    } else {
      setMessage('不是深度思考');
      setFlag(1);
    }
  };

  return (
    <Box
      m={['0 auto', '20px auto']}
      w={'100%'}
      maxW={['auto', 'min(90%, 100%)']}
      px={[0, 5]}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();

        if (!(showSelectFile || showSelectImg)) return;
        const files = Array.from(e.dataTransfer.files);

        const droppedFiles = files.filter((file) => fileTypeFilter(file));
        if (droppedFiles.length > 0) {
          onSelectFile({ files: droppedFiles });
        }

        const invalidFileName = files
          .filter((file) => !fileTypeFilter(file))
          .map((file) => file.name)
          .join(', ');
        if (invalidFileName) {
          toast({
            status: 'warning',
            title: t('chat:unsupported_file_type'),
            description: invalidFileName
          });
        }
      }}
    >
      <Box
        pt={fileList.length > 0 ? '0' : ['14px', '18px']}
        pb={['14px', '18px']}
        position={'relative'}
        bg={'#F9F9F9'}
        // boxShadow={isSpeaking ? `0 0 10px rgba(54,111,255,0.4)` : `0 0 10px rgba(0,0,0,0.2)`}
        borderRadius={['none', '16px']}
        overflow={'display'}
        {...(isPc
          ? {
              border: '1px solid',
              borderColor: 'rgba(0,0,0,0.12)'
            }
          : {
              borderTop: '1px solid',
              borderTopColor: 'rgba(0,0,0,0.15)'
            })}
      >
        {/* Chat input guide box */}
        {chatInputGuide.open && (
          <InputGuideBox
            appId={appId}
            text={inputValue}
            onSelect={(e) => {
              setValue('input', e);
            }}
            onSend={(e) => {
              handleSend(e);
            }}
          />
        )}

        {/* translate loading */}
        {RenderTranslateLoading}

        {/* file preview */}
        <Box px={[1, 3]}>
          <FilePreview fileList={fileList} removeFiles={removeFiles} />
        </Box>

        {RenderTextarea}
      </Box>
      <ComplianceTip type={'chat'} />
    </Box>
  );
};

export default React.memo(ChatInput);
