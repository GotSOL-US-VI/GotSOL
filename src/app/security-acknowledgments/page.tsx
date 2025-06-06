import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security Acknowledgments - Gotsol',
  description: 'Acknowledging security researchers who have helped improve Gotsol\'s security',
}

export default function SecurityAcknowledgments() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Security Acknowledgments</h1>
            
            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Hall of Fame</h2>
                <p className="text-gray-600 mb-6">
                  We extend our sincere gratitude to the security researchers and ethical hackers who have 
                  helped us improve the security of Gotsol. Their responsible disclosure of vulnerabilities 
                  makes our platform safer for everyone.
                </p>
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
                  <h3 className="text-xl font-semibold text-blue-800 mb-4">🏆 Recognition Criteria</h3>
                  <p className="text-blue-700 mb-3">
                    We acknowledge researchers who have:
                  </p>
                  <ul className="list-disc list-inside text-blue-600 space-y-2">
                    <li>Reported valid security vulnerabilities</li>
                    <li>Followed responsible disclosure practices</li>
                    <li>Provided clear reproduction steps</li>
                    <li>Allowed us time to fix issues before public disclosure</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">2024 Contributors</h2>
                <div className="bg-gray-50 rounded-lg p-6">
                  <p className="text-gray-600 text-center italic">
                    🔍 No security issues have been reported yet.
                  </p>
                  <p className="text-gray-500 text-center mt-2">
                    Be the first to help us improve our security!
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">How to Get Listed</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <span className="text-2xl mr-3">🔍</span>
                      <h3 className="font-semibold text-green-800">Find a Vulnerability</h3>
                    </div>
                    <p className="text-green-700">
                      Discover a security issue in our systems or applications.
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <span className="text-2xl mr-3">📧</span>
                      <h3 className="font-semibold text-blue-800">Report Responsibly</h3>
                    </div>
                    <p className="text-blue-700">
                      Follow our <a href="/security-policy" className="underline">security policy</a> for reporting.
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <span className="text-2xl mr-3">🤝</span>
                      <h3 className="font-semibold text-yellow-800">Collaborate</h3>
                    </div>
                    <p className="text-yellow-700">
                      Work with us to understand and fix the issue.
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <span className="text-2xl mr-3">🏆</span>
                      <h3 className="font-semibold text-purple-800">Get Recognized</h3>
                    </div>
                    <p className="text-purple-700">
                      Receive acknowledgment for your contribution.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Contact Information</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-700 mb-2">
                    Ready to report a security issue? Contact us through:
                  </p>
                  <ul className="text-blue-600 space-y-2">
                    <li>📧 Email: <a href="mailto:gotsol-dev@protonmail.com" className="underline font-medium">gotsol-dev@protonmail.com</a></li>
                    <li>🔒 GitHub: <a href="https://github.com/gotsol-dev/gotsol/security/advisories/new" className="underline font-medium" target="_blank" rel="noopener noreferrer">Create Security Advisory</a></li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Commitment</h2>
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6">
                  <p className="text-gray-700 mb-4">
                    At Gotsol, we believe that security is a collaborative effort. We're committed to:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 space-y-2">
                    <li>Acknowledging researchers who help improve our security</li>
                    <li>Maintaining transparent communication throughout the disclosure process</li>
                    <li>Fixing reported vulnerabilities promptly and responsibly</li>
                    <li>Continuously improving our security practices</li>
                  </ul>
                  <p className="text-gray-600 mt-4 font-medium">
                    Thank you for helping us keep Gotsol secure! 🙏
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 