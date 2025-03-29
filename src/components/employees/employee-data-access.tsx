import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useState } from 'react'

export interface Employee {
  publicKey: PublicKey
  account: {
    name: string
    role: string
    employeePubkey: PublicKey
    isActive: boolean
    created: number
    updated: number
  }
}

export interface CreateEmployeeParams {
  merchantId: PublicKey
  employeeWallet: PublicKey
  name: string
  role: string
}

export function useGetEmployees({ merchantId, enabled = true }: { merchantId: PublicKey, enabled?: boolean }) {
  const { connection } = useConnection()
  
  return useQuery({
    queryKey: ['employees', merchantId.toString()],
    queryFn: async (): Promise<Employee[]> => {
      // This would be replaced with actual blockchain data fetching
      // Simulating API response with mock data for now
      return [
        {
          publicKey: new PublicKey('11111111111111111111111111111111'),
          account: {
            name: 'John Doe',
            role: 'Manager2',
            employeePubkey: new PublicKey('11111111111111111111111111111111'),
            isActive: true,
            created: Date.now() - 1000000,
            updated: Date.now() - 500000
          }
        },
        {
          publicKey: new PublicKey('22222222222222222222222222222222'),
          account: {
            name: 'Jane Smith',
            role: 'Employee2',
            employeePubkey: new PublicKey('22222222222222222222222222222222'),
            isActive: true,
            created: Date.now() - 800000,
            updated: Date.now() - 300000
          }
        }
      ]
    },
    enabled
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  
  return useMutation({
    mutationFn: async (params: CreateEmployeeParams) => {
      const { merchantId, employeeWallet, name, role } = params
      
      // This would be replaced with actual blockchain transaction
      console.log('Creating employee:', { merchantId, employeeWallet, name, role })
      
      // Simulate a delay for API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      return true
    },
    onSuccess: (_, variables) => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['employees', variables.merchantId.toString()] })
    },
  })
}

export function useUpdateEmployeeStatus() {
  const queryClient = useQueryClient()
  const { connection } = useConnection()
  
  return useMutation({
    mutationFn: async ({ 
      merchantId, 
      employeeId, 
      isActive 
    }: { 
      merchantId: PublicKey
      employeeId: PublicKey
      isActive: boolean
    }) => {
      // This would be replaced with actual blockchain transaction
      console.log('Updating employee status:', { merchantId, employeeId, isActive })
      
      // Simulate a delay for API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      return true
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.merchantId.toString()] })
    },
  })
}

export function useUpdateEmployeeRole() {
  const queryClient = useQueryClient()
  const { connection } = useConnection()
  
  return useMutation({
    mutationFn: async ({ 
      merchantId, 
      employeeId, 
      role 
    }: { 
      merchantId: PublicKey
      employeeId: PublicKey
      role: string
    }) => {
      // This would be replaced with actual blockchain transaction
      console.log('Updating employee role:', { merchantId, employeeId, role })
      
      // Simulate a delay for API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      return true
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.merchantId.toString()] })
    },
  })
} 