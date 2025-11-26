// myitra-assistant-core/components/contact-form.tsx
'use client'

import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'

const ContactSchema = z.object({
  name: z
    .string()
    .min(2, 'Вкажіть, будь ласка, ваше імʼя'),
  email: z
    .string()
    .email('Вкажіть коректний email'),
  message: z
    .string()
    .min(10, 'Опишіть, будь ласка
