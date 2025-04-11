'use client'

import { useWalletAdapterCompat } from '@/hooks/useWalletAdapterCompat'
import { PublicKey } from '@solana/web3.js'
import { IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { AppModal, ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { 
  useGetEmployees, 
  useCreateEmployee, 
  useUpdateEmployeeStatus,
  useUpdateEmployeeRole,
  Employee 
} from './employee-data-access'

export function EmployeeList({ merchantId }: { merchantId: PublicKey }) {
  const [shouldFetch, setShouldFetch] = useState(false)
  const query = useGetEmployees({ merchantId, enabled: shouldFetch })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const handleEditClick = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowEditModal(true)
  }

  return (
    <div className="space-y-4">
      <ModalCreateEmployee 
        show={showCreateModal} 
        hide={() => setShowCreateModal(false)} 
        merchantId={merchantId}
      />
      
      {selectedEmployee && (
        <ModalEditEmployee
          show={showEditModal}
          hide={() => {
            setShowEditModal(false)
            setSelectedEmployee(null)
          }}
          employee={selectedEmployee}
          merchantId={merchantId}
        />
      )}
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Employees</h2>
        <div className="space-x-2">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setShowCreateModal(true)}
          >
            Add Employee
          </button>
          {!shouldFetch ? (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShouldFetch(true)}
            >
              Load Employees
            </button>
          ) : query.isLoading ? (
            <span className="loading loading-spinner"></span>
          ) : (
            <button
              className="btn btn-sm btn-outline"
              onClick={() => query.refetch()}
            >
              <IconRefresh size={16} />
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-base-200 p-4 rounded-lg">
        <p className="text-sm">
          Manage your business employees and their access levels. Each role has different permissions:
        </p>
        <ul className="list-disc list-inside text-sm mt-2 ml-4 space-y-1">
          <li><span className="font-semibold">Junior Employee:</span> Limited to basic tasks</li>
          <li><span className="font-semibold">Regular Employee:</span> Can handle most day-to-day operations</li>
          <li><span className="font-semibold">Senior Employee:</span> Extended access to sensitive operations</li>
          <li><span className="font-semibold">Junior Manager:</span> Can manage employees and basic configurations</li>
          <li><span className="font-semibold">Manager:</span> Full access to most business functions</li>
          <li><span className="font-semibold">Senior Manager:</span> Complete access (except owner-level functions)</li>
        </ul>
      </div>
      
      {query.isError && (
        <div className="alert alert-error">
          <span>Error: {query.error?.message.toString()}</span>
        </div>
      )}
      
      {shouldFetch && query.data && query.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Wallet</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((employee: Employee) => (
                <tr key={employee.publicKey.toString()} className="hover:bg-base-200">
                  <td className="font-medium">{employee.account.name}</td>
                  <td>
                    <RoleBadge role={employee.account.role} />
                  </td>
                  <td className="font-mono">
                    <ExplorerLink 
                      label={ellipsify(employee.account.employeePubkey.toString())} 
                      path={`account/${employee.account.employeePubkey.toString()}`} 
                    />
                  </td>
                  <td>
                    <div className={`badge ${employee.account.isActive ? 'badge-success' : 'badge-error'}`}>
                      {employee.account.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </td>
                  <td className="text-sm">
                    {new Date(employee.account.created).toLocaleDateString()}
                  </td>
                  <td>
                    <button 
                      className="btn btn-xs btn-outline" 
                      onClick={() => handleEditClick(employee)}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  let badge = ''
  let label = role
  
  switch(role) {
    case 'Employee1':
      badge = 'badge-primary badge-outline'
      label = 'Junior Employee'
      break
    case 'Employee2':
      badge = 'badge-primary'
      label = 'Regular Employee'
      break
    case 'Employee3':
      badge = 'badge-primary badge-lg'
      label = 'Senior Employee'
      break
    case 'Manager1':
      badge = 'badge-secondary badge-outline'
      label = 'Junior Manager'
      break
    case 'Manager2':
      badge = 'badge-secondary'
      label = 'Manager'
      break
    case 'Manager3':
      badge = 'badge-secondary badge-lg'
      label = 'Senior Manager'
      break
  }
  
  return <div className={`badge ${badge}`}>{label}</div>
}

function ModalCreateEmployee({ 
  show, 
  hide, 
  merchantId 
}: { 
  show: boolean
  hide: () => void
  merchantId: PublicKey 
}) {
  const [formData, setFormData] = useState({
    name: '',
    walletAddress: '',
    role: 'Employee1',
  })
  const mutation = useCreateEmployee()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync({
        merchantId,
        employeeWallet: new PublicKey(formData.walletAddress),
        name: formData.name,
        role: formData.role,
      })
      setFormData({
        name: '',
        walletAddress: '',
        role: 'Employee1',
      })
      hide()
    } catch (error) {
      console.error('Error creating employee:', error)
    }
  }

  return (
    <AppModal title="Add New Employee" show={show} hide={hide}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">
            <span className="label-text">Employee Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter employee's name"
            required
          />
        </div>
        
        <div>
          <label className="label">
            <span className="label-text">Solana Wallet Address</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full font-mono"
            value={formData.walletAddress}
            onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
            placeholder="Enter employee's Solana wallet address"
            required
          />
        </div>

        <div>
          <label className="label">
            <span className="label-text">Role & Access Level</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          >
            <option value="Employee1">Junior Employee</option>
            <option value="Employee2">Regular Employee</option>
            <option value="Employee3">Senior Employee</option>
            <option value="Manager1">Junior Manager</option>
            <option value="Manager2">Manager</option>
            <option value="Manager3">Senior Manager</option>
          </select>
        </div>

        <div className="bg-base-200 p-3 rounded-md text-sm mt-2">
          <p>
            The employee will need to log in with this wallet to access their permissions. 
            Make sure the address is correct before adding.
          </p>
        </div>

        <div className="flex justify-end space-x-2">
          <button type="button" className="btn" onClick={hide}>
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <span className="loading loading-spinner"></span>
            ) : (
              'Add Employee'
            )}
          </button>
        </div>
      </form>
    </AppModal>
  )
}

function ModalEditEmployee({ 
  show, 
  hide, 
  employee,
  merchantId
}: { 
  show: boolean
  hide: () => void
  employee: Employee
  merchantId: PublicKey
}) {
  const [formData, setFormData] = useState({
    role: employee.account.role,
    isActive: employee.account.isActive,
  })
  
  const statusMutation = useUpdateEmployeeStatus()
  const roleMutation = useUpdateEmployeeRole()
  
  const handleStatusChange = async () => {
    const newStatus = !formData.isActive
    
    try {
      await statusMutation.mutateAsync({
        merchantId,
        employeeId: employee.publicKey,
        isActive: newStatus
      })
      setFormData({ ...formData, isActive: newStatus })
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }
  
  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await roleMutation.mutateAsync({
        merchantId,
        employeeId: employee.publicKey,
        role: formData.role
      })
      hide()
    } catch (error) {
      console.error('Error updating role:', error)
    }
  }

  return (
    <AppModal title={`Manage Employee: ${employee.account.name}`} show={show} hide={hide}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Employee Name</label>
            <p className="font-semibold">{employee.account.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Wallet Address</label>
            <p className="font-mono">
              {ellipsify(employee.account.employeePubkey.toString())}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Added On</label>
            <p>{new Date(employee.account.created).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Last Updated</label>
            <p>{new Date(employee.account.updated).toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="divider"></div>
        
        <div>
          <h3 className="font-semibold mb-2">Current Status</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className={`badge ${formData.isActive ? 'badge-success' : 'badge-error'} mr-2`}>
                {formData.isActive ? 'Active' : 'Inactive'}
              </div>
              <span className="text-sm">{formData.isActive ? 'Employee has access' : 'Employee access is disabled'}</span>
            </div>
            <button 
              className={`btn btn-sm ${formData.isActive ? 'btn-error' : 'btn-success'}`}
              onClick={handleStatusChange}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : formData.isActive ? (
                'Disable Access'
              ) : (
                'Enable Access'
              )}
            </button>
          </div>
        </div>
        
        <div className="divider"></div>
        
        <form onSubmit={handleRoleChange}>
          <h3 className="font-semibold mb-2">Change Role</h3>
          <div className="flex flex-col space-y-4">
            <div>
              <label className="text-sm font-medium">Current Role</label>
              <RoleBadge role={employee.account.role} />
            </div>
            
            <select
              className="select select-bordered w-full"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="Employee1">Junior Employee</option>
              <option value="Employee2">Regular Employee</option>
              <option value="Employee3">Senior Employee</option>
              <option value="Manager1">Junior Manager</option>
              <option value="Manager2">Manager</option>
              <option value="Manager3">Senior Manager</option>
            </select>
            
            <div className="bg-base-200 p-3 rounded-md text-sm">
              <p>
                Changing an employee&apos;s role will modify their access permissions.
                This change takes effect immediately.
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button type="button" className="btn" onClick={hide}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={roleMutation.isPending || formData.role === employee.account.role}
              >
                {roleMutation.isPending ? (
                  <span className="loading loading-spinner"></span>
                ) : (
                  'Update Role'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppModal>
  )
} 