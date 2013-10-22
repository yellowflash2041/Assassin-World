require 'spec_helper'

describe IpAddressFormatValidator do

  let(:record) { Fabricate.build(:screened_ip_address, ip_address: '99.232.23.123') }
  let(:validator) { described_class.new({attributes: :ip_address}) }
  subject(:validate) { validator.validate_each(record, :ip_address, record.ip_address) }

  [nil, '99.232.23.123', '99.232.0.0/16', 'fd12:db8::ff00:42:8329', 'fc00::/7'].each do |arg|
    it "should not add an error for #{arg}" do
      record.ip_address = arg
      validate
      record.errors[:ip_address].should_not be_present
    end
  end

  it 'should add an error for invalid IP address' do
    record.ip_address = '99.99.99'
    validate
    record.errors[:ip_address].should be_present
  end
end
