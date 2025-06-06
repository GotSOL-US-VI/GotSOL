import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security Policy - Gotsol',
  description: 'Security policy and vulnerability disclosure guidelines for Gotsol',
}

export default function SecurityPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Security Policy</h1>
            
            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Reporting Security Vulnerabilities</h2>
                <p className="text-gray-600 mb-4">
                  At Gotsol, we take security seriously. We appreciate the security community's efforts to 
                  help us maintain the security of our platform and protect our users.
                </p>
                <p className="text-gray-600 mb-4">
                  If you discover a security vulnerability, please report it responsibly by following the 
                  guidelines below.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">How to Report</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">Contact Methods:</h3>
                  <ul className="text-blue-700 space-y-2">
                    <li>📧 Email: <a href="mailto:gotsol-dev@protonmail.com" className="underline">gotsol-dev@protonmail.com</a></li>
                    <li>🔒 GitHub Security Advisories: <a href="https://github.com/gotsol-dev/gotsol/security/advisories/new" className="underline" target="_blank" rel="noopener noreferrer">Create Advisory</a></li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">What to Include</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 mb-3">Please provide the following information:</p>
                  <ul className="list-disc list-inside text-gray-600 space-y-2">
                    <li>Detailed description of the vulnerability</li>
                    <li>Steps to reproduce the issue</li>
                    <li>Potential impact and severity assessment</li>
                    <li>Any proof-of-concept code (if applicable)</li>
                    <li>Your contact information for follow-up</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Response Timeline</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800">Initial Response</h3>
                    <p className="text-green-700">Within 48 hours</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-semibold text-yellow-800">Status Update</h3>
                    <p className="text-yellow-700">Within 7 days</p>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Responsible Disclosure</h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">Please DO NOT:</h3>
                  <ul className="list-disc list-inside text-red-700 space-y-1">
                    <li>Publicly disclose the vulnerability before we've had a chance to fix it</li>
                    <li>Access, modify, or delete user data</li>
                    <li>Perform actions that could harm our users or services</li>
                    <li>Use social engineering, phishing, or physical attacks</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Scope</h2>
                <p className="text-gray-600 mb-4">This policy applies to:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-2">
                  <li>gotsol-dev.vercel.app and its subdomains</li>
                  <li>Gotsol mobile applications</li>
                  <li>Official Gotsol repositories on GitHub</li>
                  <li>Any other services officially operated by Gotsol</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Recognition</h2>
                <p className="text-gray-600 mb-4">
                  We believe in recognizing researchers who help us improve our security. Upon successful 
                  resolution of reported vulnerabilities, we may:
                </p>
                <ul className="list-disc list-inside text-gray-600 space-y-2">
                  <li>Acknowledge you in our security acknowledgments page</li>
                  <li>Provide a public thank you (with your permission)</li>
                  <li>Consider appropriate recognition based on the severity and impact</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Legal</h2>
                <p className="text-gray-600">
                  We will not pursue legal action against researchers who discover and report security 
                  vulnerabilities according to this policy. We reserve the right to modify this policy 
                  at any time.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 