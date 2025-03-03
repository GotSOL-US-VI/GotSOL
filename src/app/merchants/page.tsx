const fetchMerchants = async () => {
    try {
        const merchants = await program.account.merchant.all();
        return merchants.filter(merchant => {
            try {
                // Verify the account data is valid
                return merchant.account.owner && merchant.account.entity_name;
            } catch (error) {
                console.warn('Skipping invalid merchant account:', merchant.publicKey.toString());
                return false;
            }
        });
    } catch (error) {
        console.error('Error fetching merchants:', error);
        throw error;
    }
}; 